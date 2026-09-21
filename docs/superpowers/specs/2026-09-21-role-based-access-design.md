# Desain: Role-Based Access (Superadmin vs Admin) + Device Lock

Status: Approved (menunggu spec self-review & konfirmasi akhir user)
Tanggal: 2026-09-21

## Latar Belakang

Sistem login saat ini (`src/pages/Login.jsx`) punya beberapa masalah:

- Kredensial admin/superadmin **hardcoded** di frontend (`ADMIN_CREDENTIALS`, `SUPERADMIN_CREDENTIALS`).
- Ada fitur "daftar sendiri" yang menyimpan password **plaintext di localStorage** (`kasir_registered_users`).
- Role ditentukan dengan **string matching email** (`email.includes('superadmin')`) di `Sidebar.jsx`, `Settings.jsx`, `Transaksi.jsx` — bukan sumber data resmi.
- Tidak ada proteksi route berbasis role — begitu login, admin dan superadmin punya akses identik ke semua halaman.
- Row Level Security (RLS) di Supabase **mati total** (`supabase_schema.sql`) — siapa pun yang punya `anon key` bisa baca/tulis semua tabel lewat DevTools, tanpa peduli role.
- Tidak ada konsep "device" untuk sesi login (device yang ada sekarang cuma untuk printer Bluetooth).

Tujuan desain ini: memisahkan role superadmin (akses penuh) vs admin (akses terbatas: transaksi, pelanggan, pengaturan dasar/printer), dengan admin terkunci ke 1 device, superadmin bebas multi-device, dan penegakan yang **beneran aman secara teknis** (bukan cuma sembunyiin tombol di UI).

## 1. Struktur Data (Supabase)

Tabel baru `admin_profiles`, terhubung ke `auth.users` bawaan Supabase Auth:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK, FK → `auth.users.id` | |
| `full_name` | text | Nama tampil di UI/struk |
| `role` | text | `'superadmin'` atau `'admin'` |
| `device_id` | text, nullable | Fingerprint device pertama login (khusus admin) |
| `device_label` | text, nullable | Label manusiawi, misal "Chrome di Windows" |
| `created_at` | timestamptz, default now() | |

Alasan pakai `auth.users` + tabel profil tambahan (bukan tabel user custom sendiri): supaya bisa memanfaatkan Supabase Auth asli (hashing password aman di server, JWT), dan supaya RLS policy Postgres bisa mengenali identitas (`auth.uid()`) serta role pemanggil query.

Tabel lain (`customers`, `transactions`, `packages`, `company_settings`, `ping_logs`) struktur tetap sama, ditambah RLS policy (lihat bagian 3).

## 2. Alur Login & Device-Lock

**Fingerprint device**: saat aplikasi pertama kali dibuka di suatu browser, generate `crypto.randomUUID()` sekali dan simpan sebagai `localStorage.kasir_device_id`. Label device diambil dari `navigator.userAgent` yang disederhanakan (mis. "Chrome di Windows", "Safari di iPhone").

**Login flow** (menggantikan seluruh logic `Login.jsx` saat ini — hardcoded credentials & `kasir_registered_users` dihapus):

1. `supabase.auth.signInWithPassword({ email, password })` — satu-satunya jalur otentikasi.
2. Setelah sukses, ambil baris `admin_profiles` milik user (`id = auth user id`) → didapat `role`, `device_id` tersimpan (jika ada).
3. **role = superadmin** → langsung masuk. Tidak ada pengecekan device apa pun (boleh multi-device).
4. **role = admin**:
   - `device_id` kosong (login pertama kali) → simpan `device_id` + `device_label` device saat ini ke `admin_profiles`, lanjut masuk.
   - `device_id` tersimpan cocok dengan device sekarang → lanjut masuk.
   - `device_id` tersimpan **tidak cocok** → login ditolak dengan pesan: "Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device."

**Logout** tidak menghapus `device_id` (device tetap terikat walau logout, supaya device lain tidak bisa mengisi ulang kredensial yang sama). Hanya superadmin yang bisa mengosongkan `device_id` seorang admin, lewat panel Reset Device (lihat bagian 4).

## 3. Keamanan Backend (RLS + Serverless Function)

**RLS policy** (mengaktifkan `ENABLE ROW LEVEL SECURITY` pada semua tabel yang sekarang terbuka):

- `company_settings`, `packages` → SELECT untuk semua role yang sudah login; INSERT/UPDATE/DELETE hanya `role = 'superadmin'` (dicek via join ke `admin_profiles` berdasar `auth.uid()`).
- `customers`, `transactions` → SELECT + INSERT untuk semua role yang sudah login (admin memang harus bisa menambah transaksi & pelanggan); UPDATE/DELETE hanya superadmin (mencegah admin mengubah/menghapus riwayat).
- `admin_profiles` → setiap user SELECT baris miliknya sendiri; superadmin SELECT & UPDATE semua baris (untuk reset device, ubah nama, dll). Admin **tidak** boleh UPDATE baris miliknya sendiri (mencegah self-upgrade role atau melepas device lock sendiri).
- `ping_logs` → tidak berubah (dipakai sistem monitoring E-Billing, tidak terkait role).

**Serverless function di Vercel** (`api/admin/create-user.js`, `api/admin/delete-user.js`): pembuatan/penghapusan akun admin baru membutuhkan Supabase Admin API, yang mewajibkan `service_role` key — kunci ini **tidak boleh pernah ada di kode frontend**, karena punya akses penuh ke seluruh database dan akan membuat semua RLS di atas jadi percuma jika bocor.

- Function berjalan di server Vercel (Vercel Functions), bukan di browser.
- `service_role` key disimpan sebagai environment variable biasa (bukan prefix `VITE_`), sehingga tidak pernah ikut ter-bundle ke kode frontend.
- Function memverifikasi dulu bahwa request datang dari user yang sudah login dan ber-role `superadmin` (validasi JWT dari header `Authorization`) sebelum mengeksekusi pembuatan/penghapusan akun.

Reset device dan daftar akun admin **tidak** memerlukan serverless — cukup baca/tulis langsung ke `admin_profiles` melalui client Supabase biasa, dilindungi RLS di atas.

## 4. UI: Sidebar, Route Guard, Settings

Mengganti seluruh pola cek role berbasis string-matching email dengan satu sumber kebenaran: `session.profile.role` (hasil join ke `admin_profiles`, disimpan sekali di state `App.jsx` setelah login berhasil).

**Sidebar** (`src/components/Sidebar.jsx`) — filter menu berdasarkan role:
- Admin: hanya menu **Transaksi/POS**, **Pelanggan**, dan **Settings**.
- Superadmin: semua menu seperti sekarang (Dashboard, Riwayat, Pelanggan, Transaksi, Instansi, Aktivitas, Settings).

**Route guard** (`src/App.jsx`) — sebelum merender tiap `<Route>`, cek role. Jika admin mengakses URL yang tidak diizinkan secara langsung (mis. mengetik `/instansi` di address bar), redirect ke `/pos`. Ini penting karena menyembunyikan menu saja tidak mencegah akses via URL langsung.

**Settings** (`src/pages/Settings.jsx`) — pecah section berdasarkan role:
- Admin: hanya section **Koneksi Hardware (printer)** dan **Profil & Ganti Akun**.
- Superadmin: semua section yang ada sekarang, ditambah section baru **"Manajemen Akun"**: tabel daftar admin (nama, device_label, status device terkunci/kosong), tombol **"Buat Admin Baru"** (modal: nama, email, password → memanggil serverless function `create-user`), dan tombol **"Reset Device"** per baris (langsung update `admin_profiles.device_id = null` via client, dilindungi RLS).

## 5. Migrasi

Urutan wajib agar tidak ada yang ter-lock keluar dari sistem:

1. Jalankan migrasi SQL: buat tabel `admin_profiles`, aktifkan RLS + semua policy di bagian 3.
2. Buat **1 akun superadmin asli** di Supabase Auth (email & password diberikan langsung oleh pemilik aplikasi, tidak disimpan di repo/spec ini) + insert baris `admin_profiles` dengan `role = 'superadmin'`. Langkah ini **wajib** dilakukan sebelum kode baru dideploy, karena begitu hardcoded credentials dihapus, akun ini satu-satunya jalan masuk.
3. Deploy kode baru: `Login.jsx`, `Sidebar.jsx`, `Settings.jsx`, `App.jsx`, migrasi SQL + RLS aktif, 2 serverless function baru.
4. Superadmin login pertama kali, lalu membuat akun-akun admin (kasir) yang dibutuhkan lewat panel "Manajemen Akun".
5. Data yang sudah ada (transaksi, pelanggan) tidak berubah — perubahan ini hanya menambah lapisan akses, bukan migrasi data.

**Yang dihapus/tidak berfungsi lagi setelah ini**: 2 akun demo hardcoded (`admin@kasir.com` / `superadmin@kasir.com`) dan fitur "daftar sendiri" (self-registration). Ini keputusan yang sudah disetujui — akun admin baru hanya bisa dibuat oleh superadmin.

## Keterbatasan yang Disadari

- Fingerprint device berbasis `localStorage`, bukan ID hardware sungguhan. Jika admin menghapus data browser/data situs, atau memakai mode private/incognito, device akan dianggap "device baru" dan login akan ditolak sampai superadmin reset. Ini keterbatasan inheren aplikasi web (browser tidak mengekspos ID hardware asli untuk alasan privasi) dan bisa dijelaskan ke pengguna sebagai perilaku normal.
- Satu akun superadmin untuk saat ini (sesuai keputusan) — jika ke depan dibutuhkan lebih dari satu, `admin_profiles.role` sudah cukup fleksibel untuk menambah baris `role='superadmin'` lain tanpa perubahan skema.
