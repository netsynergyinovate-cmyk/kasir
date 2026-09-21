-- ==========================================
-- MIGRASI: Tahap ('stage') pada log sinkron Runsnet
-- Jalankan SETELAH supabase_runsnet_sync.sql. Aman dijalankan ulang.
--
-- Sebelumnya runsnet_sync_log cuma mencatat SATU baris per transaksi (tahap kirim pembayaran,
-- dijalankan webhook setelah transaksi lunas). Sekarang ditambah tahap kedua: pencarian nomor
-- invoice asli Runsnet (dijalankan SAAT transaksi baru dibuat, sebelum lunas), supaya superadmin
-- bisa lihat di satu log yang sama apakah nomor invoice sudah "sama dengan Runsnet" atau belum,
-- terpisah dari status pengiriman pembayarannya.
-- ==========================================

alter table runsnet_sync_log add column if not exists stage text not null default 'payment';

alter table runsnet_sync_log drop constraint if exists runsnet_sync_log_stage_check;
alter table runsnet_sync_log add constraint runsnet_sync_log_stage_check check (stage in ('invoice_lookup', 'payment'));

-- Ganti unique(transaction_id) -> unique(transaction_id, stage): satu transaksi sekarang boleh
-- punya 2 baris log (satu per tahap), tapi tetap anti-dobel per tahap.
alter table runsnet_sync_log drop constraint if exists runsnet_sync_log_transaction_id_key;
alter table runsnet_sync_log drop constraint if exists runsnet_sync_log_transaction_id_stage_key;
alter table runsnet_sync_log add constraint runsnet_sync_log_transaction_id_stage_key unique (transaction_id, stage);
