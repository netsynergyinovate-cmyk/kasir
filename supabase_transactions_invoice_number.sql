-- ==========================================
-- MIGRASI: Nomor invoice Runsnet di transaksi
-- Aman dijalankan ulang.
--
-- id transaksi (PK, format INV-<timestamp>) TETAP seperti semula supaya tidak mengganggu apa pun
-- yang sudah memakainya. Kolom baru invoice_number menyimpan nomor invoice ASLI Runsnet kalau
-- ketemu saat transaksi dibuat (lihat api/runsnet/invoice-lookup.js); kalau tidak ketemu, kosong
-- dan struk/riwayat tetap pakai id seperti biasa (lihat src/utils/format.js -> getInvoiceNumber).
-- ==========================================

alter table transactions add column if not exists invoice_number text;
