-- ==========================================
-- SCHEMA UNTUK DATABASE KASIR (SUPABASE)
-- Tanggal Update: 2026-06-16
-- Fitur: Admin Stats, CS Payment, Pagination
-- ==========================================

-- 1. Tabel Pelanggan
create table if not exists customers (
  id text primary key,
  pppoe_id text,
  name text not null,
  nickname text,
  address text,
  package text,
  status text default 'aktif',
  due_date int,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Tabel Paket Internet
create table if not exists packages (
  id bigint primary key generated always as identity,
  name text not null,
  price bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Tabel Transaksi
create table if not exists transactions (
  id text primary key,
  date timestamp with time zone not null,
  customer_name text,
  instansi_name text,
  package_name text,
  service_name text,
  price bigint not null,
  status text,
  payment_method text, -- 'Cash', 'Transfer Bank', 'QRIS', 'CS'
  amount_paid bigint,
  cashier_name text,
  type text not null, -- 'retail' atau 'instansi'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Tabel Pengaturan Perusahaan
create table if not exists company_settings (
  id int primary key default 1,
  name text,
  address text,
  phone text,
  logo_url text,
  admin_name text default 'Admin Utama',
  admin_fee bigint default 10000,
  app_pin text,
  api_monitoring_url text,
  api_monitoring_key text,
  api_monitoring_enabled boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Migrasi skema untuk menambahkan kolom jika tabel sudah ada sebelumnya
alter table company_settings add column if not exists api_monitoring_url text;
alter table company_settings add column if not exists api_monitoring_key text;
alter table company_settings add column if not exists api_monitoring_enabled boolean default false;
alter table customers add column if not exists pppoe_id text;
alter table transactions add column if not exists pppoe_id text;

-- 5. Tabel Ping Logs (Keep-Alive Database)
create table if not exists ping_logs (
  id bigint primary key generated always as identity,
  pinged_at timestamp with time zone default timezone('utc'::text, now()),
  source text default 'unknown'
);

-- (Opsional) Otomatisasi Ping Langsung dari Dalam PostgreSQL Supabase (pg_cron)
-- Un-comment 3 baris di bawah jika ingin PostgreSQL Supabase melakukan ping internal setiap jam 00:00 UTC:
-- create extension if not exists pg_cron;
-- select cron.schedule('auto-keepalive-24h', '0 0 * * *', $$ insert into ping_logs (source) values ('pg_cron_internal'); $$);


-- 6. MATIKAN RLS (Agar aplikasi bisa baca/tulis tanpa login Supabase)
-- SANGAT DISARANKAN aktifkan kembali jika sudah menggunakan sistem Login/Auth.
alter table customers disable row level security;
alter table packages disable row level security;
alter table transactions disable row level security;
alter table company_settings disable row level security;
alter table ping_logs disable row level security;

-- 6. SEED DATA AWAL (Pengaturan & Contoh) --

-- Masukkan Data Perusahaan Awal
insert into company_settings (id, name, address, phone, admin_name, admin_fee)
values (1, 'PT Net Synergy Inovate', 'Jl. Teknologi Canggih No. 99, Jakarta', '0812-3456-7890', 'Admin Utama', 10000)
on conflict (id) do update set 
  admin_name = excluded.admin_name,
  admin_fee = excluded.admin_fee;

-- Masukkan Data Paket Internet Awal
insert into packages (name, price)
values 
  ('Paket RT RW 10Mbps', 150000),
  ('Paket RT RW 20Mbps', 250000),
  ('Paket Pro 50Mbps', 400000);

-- Masukkan Data Pelanggan Contoh
insert into customers (id, name, nickname, address, package, status, due_date)
values 
  ('CUST-001', 'Budi Santoso', 'Budi', 'Jl. Merdeka No.10', 'Paket RT RW 10Mbps', 'aktif', 15),
  ('CUST-002', 'Siti Aminah', 'Siti', 'Perum Asri Blok B2', 'Paket RT RW 20Mbps', 'isolir', 5),
  ('CUST-003', 'Warung Kopi Berkah', 'Warkop', 'Jl. Sudirman 45', 'Paket Pro 50Mbps', 'aktif', 1);
