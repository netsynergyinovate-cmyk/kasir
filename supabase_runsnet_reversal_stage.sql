-- ==========================================
-- MIGRASI: tahap 'reversal' pada log sinkron Runsnet
-- Jalankan SETELAH supabase_runsnet_log_stage.sql. Aman dijalankan ulang.
--
-- Menghapus transaksi di Riwayat kini juga membatalkan (reversal) pembayarannya di Runsnet; hasilnya dicatat
-- di runsnet_sync_log dengan stage 'reversal'.
-- ==========================================

alter table runsnet_sync_log drop constraint if exists runsnet_sync_log_stage_check;
alter table runsnet_sync_log add constraint runsnet_sync_log_stage_check check (stage in ('invoice_lookup', 'payment', 'reversal'));

notify pgrst, 'reload schema';
