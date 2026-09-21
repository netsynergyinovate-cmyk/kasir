# Setup Sinkronisasi Runsnet

Fitur ini menandai invoice lunas di `app.runsnet.id` otomatis, tiap ada pembayaran lunas di KAsir.
Dibangun sesuai kesepakatan: default **mati**, dan mode **uji coba** (tidak benar-benar mengirim)
default **hidup**, jadi tidak ada risiko sampai Anda sengaja menyalakannya.

## Yang sudah selesai

- `supabase_runsnet_sync.sql` — kolom saklar di `company_settings`, tabel `runsnet_sync_log`
  (anti kirim dobel per transaksi), tabel `runsnet_session` (simpan sesi login).
- `api/runsnet/webhook.js` — Vercel Function yang dipanggil Supabase Database Webhook tiap ada
  transaksi baru. Login memakai `RUNSNET_USERNAME`/`RUNSNET_PASSWORD`, cari invoice, kirim mass
  action pembayaran tunai.
- Panel **Sinkronisasi Runsnet** di Pengaturan (khusus superadmin): saklar aktif/mati, saklar mode
  uji coba, dan log 10 percobaan terakhir.

## Yang BELUM bisa jalan sungguhan

`api/_lib/runsnetClient.js` berisi beberapa nilai `REPLACE_ME` (path endpoint pencarian invoice dan
pembayaran, nama field formnya). Runsnet tidak punya API resmi, jadi nilai ini harus diambil dari
request asli, bukan ditebak. Sampai diisi, tiap percobaan sinkron otomatis tercatat sebagai
`skipped_not_configured` di log — tidak ada request yang benar-benar terkirim ke Runsnet.

### Cara mengisinya

1. Login ke `app.runsnet.id`, buka DevTools (F12) tab **Network**, centang **Preserve log**.
2. Buka **Main Menu → FTTH → Invoice**, cari satu invoice. Di tab Network, cari request
   pencariannya, klik kanan → **Copy → Copy as cURL**.
3. Centang invoice itu, buka **Mass Action → Buat Pembayaran → Tunai**, berhenti sebelum menekan
   tombol final **Bayar**, lalu salin request yang terkirim sampai tahap itu.
4. Dari dua request itu, isi di `api/_lib/runsnetClient.js`:
   - `searchPath`, `searchQueryField`, `searchResultIdField`
   - `paymentPath`, `paymentMethodField`, `paymentMethodValue`, `paymentInvoiceIdField`
5. Commit, lalu deploy ulang.

## Environment variables (Vercel, Production)

Server-side saja — **jangan** pakai prefix `VITE_`, dan jangan taruh di kode frontend:

- `RUNSNET_BASE_URL` — default `https://app.runsnet.id` kalau tidak diisi
- `RUNSNET_USERNAME`
- `RUNSNET_PASSWORD`
- `RUNSNET_WEBHOOK_SECRET` — string acak sendiri, dipakai untuk memverifikasi bahwa panggilan ke
  `/api/runsnet/webhook` benar-benar dari Supabase, bukan dari internet umum.
- `SUPABASE_SERVICE_ROLE_KEY` — sudah pernah diisi untuk fitur lain; pastikan masih ada.

## Menyambungkan Supabase Database Webhook

Di Supabase Dashboard, **Database → Webhooks → Create a new hook**:

- Table: `transactions`
- Events: `Insert`
- Type: HTTP Request, method `POST`, URL: `https://<domain-vercel-anda>/api/runsnet/webhook`
- HTTP Headers: tambahkan `x-webhook-secret: <nilai RUNSNET_WEBHOOK_SECRET>`

## Urutan menyalakan fitur ini (jangan dilompati)

1. Jalankan `supabase_runsnet_sync.sql`.
2. Set environment variables di atas, deploy.
3. Sambungkan Database Webhook seperti di atas.
4. Isi `REPLACE_ME` di `runsnetClient.js` (lihat "Cara mengisinya"), deploy ulang.
5. Di Pengaturan, nyalakan **Aktifkan sinkronisasi otomatis**, tapi biarkan **Mode uji coba** tetap
   menyala. Buat beberapa transaksi lunas, cek di log Settings apakah `search_query`-nya (nama
   pelanggan/PPPoE ID) sudah masuk akal dan cocok dengan yang ada di Runsnet.
6. Kalau sudah yakin, matikan **Mode uji coba**. Sekarang pembayaran benar-benar terkirim otomatis.
7. Kalau ada masalah kapan saja, matikan **Aktifkan sinkronisasi otomatis** — semua berhenti seketika
   tanpa perlu ubah kode atau deploy ulang.
