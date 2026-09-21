-- ==========================================
-- PERBAIKAN: kolom customers yang sudah lama ditulis di supabase_schema.sql ternyata TIDAK
-- PERNAH benar-benar dibuat di database ini. Ditemukan 2026-09-21 saat menguji sinkron pelanggan
-- Runsnet — kolom ini juga dipakai fitur Edit Pelanggan dan Sinkron E-Billing yang sudah ada
-- sebelumnya, jadi kemungkinan sudah lama diam-diam gagal tersimpan juga. Aman dijalankan ulang.
-- ==========================================
alter table customers add column if not exists custid text;
alter table customers add column if not exists customer_id text;
alter table customers add column if not exists pppoe_id text;
alter table customers add column if not exists source text default 'kasir';
alter table customers add column if not exists last_synced timestamp with time zone;
alter table customers add column if not exists phone text;
alter table customers add column if not exists ip_address text;
alter table customers add column if not exists mac_address text;
alter table customers add column if not exists serial_number text;
alter table customers add column if not exists router_name text;
alter table customers add column if not exists price bigint;
alter table customers add column if not exists last_payment_date text;

-- Verifikasi: 12 baris di bawah ini harus semua muncul.
select column_name from information_schema.columns
where table_name = 'customers' and table_schema = 'public'
  and column_name in (
    'custid', 'customer_id', 'pppoe_id', 'source', 'last_synced',
    'phone', 'ip_address', 'mac_address', 'serial_number', 'router_name',
    'price', 'last_payment_date'
  );
