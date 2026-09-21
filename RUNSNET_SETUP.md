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

## Status (per 2026-09-21)

Runsnet ternyata tidak pakai API JSON — semua navigasi lewat satu file `view/index.php` dengan
satu parameter GET "kunci menu" (nama tetap, nilai menentukan halaman/aksi) ditambah `data1`/
`data2`/`data3` untuk parameter aksi.

- **Login**: sudah terverifikasi jalan (diuji lewat tombol Uji Koneksi). Field asli: `username`,
  `password`, `simpan` (kosong) — bukan `panelOption` seperti dugaan awal.
- **Pembayaran** (`payInvoiceCash`): sudah terisi nilai asli, hasil insiden 2026-09-21 (lihat
  peringatan di bawah). GET ke `view/index.php` dengan kunci menu + `data1`=kode invoice +
  `data2`="Pembayaran Tunai" + `data3`=tanggal **langsung mengeksekusi pembayaran** — tidak ada
  konfirmasi terpisah di sisi server.
- **Pencarian invoice** (`searchInvoice`): **belum diisi**, masih melempar error. Ini satu-satunya
  bagian yang menahan seluruh pipa tetap di status `skipped_not_configured` (aman, tidak mengirim
  apa pun), walau field pembayaran sudah terisi.

> **⚠️ Peringatan dari pengalaman nyata:** saat menangkap request pembayaran lewat DevTools,
> menavigasi/memuat URL `data1/data2/data3` itu di browser **langsung mengeksekusi pembayaran
> sungguhan** (bukan sekadar preview sebelum tombol final). Ini pernah membuat satu invoice
> tercatat lunas secara tidak sengaja (sudah direversal manual di Runsnet). Untuk field yang masih
> kosong: JANGAN menavigasi sampai selesai kalau itu memicu aksi serupa. Cukup lihat request-nya di
> tab Network, salin sebagai cURL, dan berhenti sebelum server benar-benar merespons/redirect kalau
> memungkinkan.

### Cara mengisi `invoiceListMenuValue` (satu-satunya yang tersisa)

1. Login ke `app.runsnet.id`, buka DevTools (F12) tab **Network**, klik **All** (bukan cuma
   Fetch/XHR), centang **Preserve log**.
2. Buka **Main Menu → FTTH → Invoice/Payment** (halaman yang menampilkan tabel seperti
   PAYMENTCODE/INVOICECODE/CUSTID/CUSTNAMA).
3. Cari request yang memuat tabel itu pertama kali (biasanya request document/GET ke
   `view/index.php?<kunci-menu>=...`, tanpa `data1/data2/data3`). Klik kanan → **Copy → Copy as
   cURL**.
4. Kalau ada kolom pencarian di atas tabel itu dan mengetik di situ TIDAK memicu request jaringan
   baru (cek tab Network saat mengetik) — berarti pencariannya di sisi browser (client-side), dan
   satu tangkapan di langkah 3 sudah cukup.
5. Kirim hasilnya (setelah menghapus isi header `Cookie:`) untuk diisi ke `invoiceListMenuValue`
   dan logika pemrosesan tabelnya di `searchInvoice()`.

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
4. Isi `invoiceListMenuValue` di `runsnetClient.js` (lihat "Cara mengisi" di atas), deploy ulang.
5. Di Pengaturan, nyalakan **Aktifkan sinkronisasi otomatis**, tapi biarkan **Mode uji coba** tetap
   menyala. Buat beberapa transaksi lunas, cek di log Settings apakah `search_query`-nya (nama
   pelanggan/PPPoE ID) sudah masuk akal dan cocok dengan yang ada di Runsnet.
6. Kalau sudah yakin, matikan **Mode uji coba**. Sekarang pembayaran benar-benar terkirim otomatis.
7. Kalau ada masalah kapan saja, matikan **Aktifkan sinkronisasi otomatis** — semua berhenti seketika
   tanpa perlu ubah kode atau deploy ulang.
