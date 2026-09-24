# Design Spec: Kustomisasi Icon Map Admin, Pembagian Hak Akses Granular, Sistem Komisi Super Admin & Upgrade UI Settings

**Tanggal:** 2026-09-24  
**Status:** Approved by User  
**Tujuan:** Mengimplementasikan kustomisasi icon admin di peta agar tidak sama dengan pelanggan dan tidak sama antar admin, pembagian hak akses admin yang granular (bisa dipecah/dibagi per fitur mandiri), sistem pengiriman komisi admin oleh super admin yang tampil di dashboard admin, serta modernisasi UI Settings.

---

## 1. Konteks & Latar Belakang

Aplikasi KAsir digunakan oleh PT Net Synergy Inovate untuk manajemen kasir, penagihan WiFi bulanan, dan pelacakan teknisi/petugas lapangan. Sebelumnya:
1. Marker admin di peta (`RouteMap.jsx`) hanya berupa pin ungu generik dengan huruf 'A' yang bentuknya mirip dengan pin pelanggan, dan semua admin memiliki icon yang sama persis.
2. Hak akses admin di panel Superadmin hanya sebatas membatasi 6 rute URL utama secara kasar tanpa bisa memecah fitur-fitur spesifik di dalam setiap halaman (misal: kasir boleh buat transaksi tapi tidak boleh ubah harga manual, atau teknisi boleh buka rute tanpa bisa batalkan transaksi keuangan).
3. Pendapatan admin (komisi jasa kasir) baru sebatas angka kalkulasi di dashboard tanpa ada mekanisme resmi bagi Super Admin untuk mentransfer/mengirimkan komisi tersebut ke admin dan mencatat riwayat pencairannya.
4. Tampilan Settings memerlukan upgrade visual agar lebih modern, rapi, dan mudah dikonfigurasi.

---

## 2. Arsitektur & Penyimpanan Data (Hybrid JSONB + Relasional)

Untuk menjamin sistem langsung berjalan instan di Supabase tanpa risiko error `"relation not found"` dan mempertahankan 100% kompatibilitas mundur dengan 444 unit test yang ada:

### 2.1 Skema Data di `admin_profiles.allowed_paths` (JSONB)
Kolom `allowed_paths` di tabel `admin_profiles` mendukung format objek:
```json
{
  "paths": ["/pos", "/customers", "/history", "/rute"],
  "permissions": [
    "pos.view", "pos.retail", "pos.voucher", "pos.print",
    "customers.view", "customers.create", "customers.edit",
    "history.view", "history.proof_view", "history.proof_upload",
    "rute.view", "rute.visit"
  ],
  "map_icon": {
    "type": "motor",
    "color": "#10b981",
    "label": "WR"
  },
  "commissions": [
    {
      "id": "COMM-1790234000000",
      "amount": 250000,
      "payment_method": "Transfer Bank (BCA)",
      "notes": "Pencairan komisi penagihan periode 1-24 September 2026",
      "status": "TERKIRIM",
      "sent_by_name": "CS NET.SI (Super Admin)",
      "sent_at": "2026-09-24T06:30:00.000Z"
    }
  ]
}
```
*Jika data `allowed_paths` di database masih berupa array string lama (misal `['/', '/pos']`), fungsi `normalizeAdminAccess` otomatis memetakan permission bawaan agar admin lama tidak kehilangan akses.*

### 2.2 Migrasi Tabel Relasional Pendamping (`supabase_admin_commissions.sql`)
Disediakan skrip migrasi SQL resmi untuk pencatatan komisi skala perusahaan:
```sql
create table if not exists admin_commissions (
  id text primary key,
  admin_id uuid not null references admin_profiles(id) on delete cascade,
  admin_name text not null,
  amount numeric not null,
  payment_method text default 'Transfer Bank',
  notes text,
  status text not null default 'TERKIRIM',
  sent_by_name text,
  sent_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

---

## 3. Rincian Fitur & Komponen

### 3.1 Fitur 1: Kustomisasi Icon Map Admin (`src/utils/adminMapIcons.js` & `src/components/RouteMap.jsx`)
* **Perbedaan Bentuk dari Pin Pelanggan:**
  * Pelanggan = Teardrop pin vertikal dengan nomor urut (`1, 2, 3...`) dan warna status.
  * Admin = **Floating Navigation Disc Badge (Lencana Bulat Lapangan)** diameter 36px dengan border putih tebal, icon kendaraan SVG di tengah, lencana inisial di pojok atas, pointer segitiga di bawah, dan label nama admin mengambang di bawahnya.
* **7 Pilihan Jenis Icon:**
  * `motor`: Sepeda Motor 🏍️ (kurir/penagih keliling)
  * `mobil`: Mobil Operasional 🚗 (tim armada)
  * `technician`: Teknisi Jaringan ⚡ (antena/kabel FO)
  * `person`: Petugas Lapangan 🚶 (surveyor/sales)
  * `admin`: Admin Kasir 🛡️ (posko toko)
  * `crown`: Super Admin 👑
  * `beacon`: Radar Lokasi 🎯
* **8 Pilihan Warna Tema:**
  * Emerald (`#10b981`), Biru (`#2563eb`), Violet (`#7c3aed`), Rose (`#f43f5e`), Amber (`#f59e0b`), Cyan (`#06b6d4`), Indigo (`#4f46e5`), Orange (`#ea580c`).
  * Jika belum memilih warna, sistem menggunakan fungsi deterministik hash nama/ID sehingga antar admin otomatis memiliki warna yang berbeda.
* **Lokasi Pengaturan:**
  * **Pengaturan > Umum (Profil Akun Saya):** Setiap admin dapat memilih jenis icon, warna tema, dan inisial nama dengan *live preview*.
  * **Pengaturan > Admin (Atur Akses):** Super Admin juga dapat menentukan icon dan warna untuk setiap admin.

### 3.2 Fitur 2: Pembagian Hak Akses Granular (`src/utils/permissions.js` & `src/components/AdminAccessModal.jsx`)
Checklist mandiri per-fitur dikelompokkan ke dalam 8 modul:
1. **Transaksi & Kasir (`pos`):**
   * `pos.view` (Buka Halaman Kasir)
   * `pos.retail` (Proses Pembayaran Retail Bulanan)
   * `pos.voucher` (Penjualan Voucher WiFi/Hotspot)
   * `pos.custom_price` (Ubah Harga/Diskon Manual)
   * `pos.print` (Cetak Struk Transaksi)
2. **Pelanggan (`customers`):**
   * `customers.view` (Lihat Pelanggan)
   * `customers.create` (Tambah Pelanggan Baru)
   * `customers.edit` (Edit Profil/Paket/Koordinat)
   * `customers.delete` (Hapus Pelanggan)
   * `customers.export` (Ekspor Excel/CSV)
   * Pembatasan pelanggan spesifik (tetap terintegrasi)
3. **Riwayat Transaksi (`history`):**
   * `history.view` (Lihat Riwayat Transaksi)
   * `history.cancel` (Batalkan/Refund Transaksi)
   * `history.proof_view` (Lihat Bukti Transfer)
   * `history.proof_upload` (Unggah/Ganti Bukti Transfer)
4. **Rute Kunjungan & Lapangan (`rute`):**
   * `rute.view` (Buka Peta & Rute Kunjungan)
   * `rute.reorder` (Susun Urutan Kunjungan)
   * `rute.visit` (Catat Hasil Kunjungan/Check-in)
5. **WhatsApp Gateway (`whatsapp`):**
   * `whatsapp.invoice` (Kirim Invoice Struk WA)
   * `whatsapp.reminder` (Kirim Pengingat Tagihan/Isolir)
   * `whatsapp.logs` (Lihat Log WhatsApp)
6. **Laporan & Keuangan (`finance`):**
   * `finance.view_activity` (Menu Aktivitas & Mutasi)
   * `finance.view_omset` (Lihat Total Omset & Laba)
7. **Pengaturan Toko (`settings`):**
   * `settings.view` (Buka Menu Pengaturan)
   * `settings.printer` (Atur Printer Bluetooth)
   * `settings.packages` (Ubah Paket & Harga)
   * `settings.company` (Ubah Info Toko & Biaya Admin)
8. **Integrasi Runsnet (`runsnet`):**
   * `runsnet.sync` (Kirim Pembayaran ke Runsnet)
   * `runsnet.sync_customers` (Tarik/Sinkron Pelanggan)

*Tombol "Pilih Semua" dan "Batal Semua" disediakan di tiap header modul untuk kemudahan konfigurasi.*

### 3.3 Fitur 3: Sistem Pengiriman & Pencatatan Komisi Super Admin (`src/utils/commissions.js`, `Dashboard.jsx`, `Settings.jsx`)
1. **Perhitungan Komisi Otomatis:**
   * Diambil dari transaksi lunas yang diproses admin (`cashier_id === admin.id` atau nama kasir cocok) dikalikan biaya admin toko (`company_settings.admin_fee || 10000`).
2. **Panel Kirim Komisi Super Admin (di Pengaturan > Akun Admin):**
   * Menampilkan ringkasan setiap admin: Total Transaksi, Komisi Diperoleh, Komisi Cair, dan Sisa Pending.
   * Tombol **"Kirim Komisi"**:
     * Membuka popup transfer komisi.
     * Tombol cepat *"Kirim Semua Komisi Berjalan (Rp X.XXX)"* atau input manual.
     * Pilihan metode (BCA, BRI, Mandiri, BNI, Dana, GoPay, Tunai).
     * Kolom catatan/keterangan periode.
     * Simpan & catat ➔ Realtime update ke database dan dashboard admin.
3. **Tampilan Dashboard Admin (`Dashboard.jsx`):**
   * Kartu Ringkasan Komisi:
     * 💳 **Total Komisi Diterima (Sudah Cair)** (angka hijau tebal)
     * ⏳ **Komisi Berjalan (Menunggu Pencairan)** (angka amber tebal)
   * Daftar Riwayat Pengiriman Komisi:
     * Tanggal, Jam, Nominal Hijau (`+ Rp 250.000`), Pengirim (*CS NET.SI*), Catatan, dan Status `✅ DITRANSFER`.

### 3.4 Fitur 4: Upgrade UI Settings (`src/pages/Settings.jsx`)
* Tampilan tab akun admin lebih bersih dengan kartu profil modern, lencana peran, status device, dan indikator komisi.
* Panel Profil Saya di tab Umum dilengkapi kartu *Live Preview Marker Peta* interaktif.
* Modal Atur Akses yang responsif, terstruktur per modul, dan nyaman digunakan di layar HP maupun laptop.

---

## 4. Pengujian & Verifikasi
1. **Unit Testing (`vitest`):**
   * `tests/utils/adminMapIcons.test.js`: Memverifikasi 7 tipe icon, 8 warna, hash deterministik, dan render HTML Leaflet divIcon.
   * `tests/utils/permissions.test.js`: Memverifikasi fungsi `hasPermission`, `isPathAllowedForRole` dengan objek permission, dan fallback array bawaan.
   * `tests/utils/commissions.test.js`: Memverifikasi kalkulasi komisi berjalan, komisi cair, dan pencatatan riwayat komisi.
2. **Regression Testing:**
   * Memastikan seluruh 53 file test (444 tests) yang ada sebelumnya tetap lulus 100%.
3. **Production Build:**
   * Memastikan `npm run build` berjalan bersih tanpa error sintaks atau modul hilang.

