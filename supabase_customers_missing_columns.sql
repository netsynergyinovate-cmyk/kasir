-- ==========================================
-- PERBAIKAN: kolom customers yang sudah ditulis di supabase_schema.sql (custid, customer_id,
-- pppoe_id, source, last_synced) ternyata TIDAK PERNAH benar-benar dibuat di database ini.
-- Ditemukan 2026-09-21 saat menguji sinkron pelanggan Runsnet — juga berarti fitur "Sinkron
-- E-Billing" yang sudah ada sebelumnya kemungkinan diam-diam gagal menyimpan kolom ini juga.
-- Aman dijalankan ulang.
-- ==========================================
alter table customers add column if not exists custid text;
alter table customers add column if not exists customer_id text;
alter table customers add column if not exists pppoe_id text;
alter table customers add column if not exists source text default 'kasir';
alter table customers add column if not exists last_synced timestamp with time zone;

-- Verifikasi: kelima kolom di atas harus muncul di sini.
select column_name from information_schema.columns
where table_name = 'customers' and table_schema = 'public'
  and column_name in ('custid', 'customer_id', 'pppoe_id', 'source', 'last_synced');
