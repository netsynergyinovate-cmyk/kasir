-- ==========================================
-- MIGRASI: tahap 'check' pada log sinkron Runsnet
-- Jalankan SETELAH supabase_runsnet_log_customer_name.sql. Aman dijalankan ulang.
--
-- Sebelumnya membaca status invoice (tombol "Cek ulang"/"Cek status PAID" di Riwayat, atau pengecekan
-- otomatis saat halaman Riwayat dibuka) tidak tercatat di mana pun -- superadmin tidak bisa lihat kapan
-- dan apa hasil pengecekan itu. Sekarang tiap pengecekan dicatat sebagai baris log stage 'check', jadi
-- alur kerja lengkap (Cek Nomor Invoice -> Kirim Pembayaran -> Cek Status -> Reversal) terlihat di satu
-- kartu per invoice di tab Runsnet.
-- ==========================================

alter table runsnet_sync_log drop constraint if exists runsnet_sync_log_stage_check;
alter table runsnet_sync_log add constraint runsnet_sync_log_stage_check check (stage in ('invoice_lookup', 'payment', 'reversal', 'check'));

notify pgrst, 'reload schema';
