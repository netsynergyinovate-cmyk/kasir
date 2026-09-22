-- ==========================================
-- MIGRASI: nama pelanggan di log sinkron Runsnet
-- Jalankan SETELAH supabase_runsnet_log_stage.sql. Aman dijalankan ulang.
--
-- Sebelumnya kartu log Runsnet mencari nama pelanggan dari tabel transactions KAsir. Begitu
-- transaksinya dihapus (mis. setelah reversal), namanya tidak ketemu lagi dan kartu cuma
-- menampilkan ID/kode. Sekarang nama diambil dari RUNSNET SENDIRI (CustNama di respons invoice/
-- payment) dan disimpan di baris log-nya sendiri, jadi tetap ada walau transaksinya sudah dihapus.
-- ==========================================

alter table runsnet_sync_log add column if not exists customer_name text;
