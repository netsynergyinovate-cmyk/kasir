# Panduan Setup Database Supabase

Silakan *Copy* (Salin) seluruh blok kode SQL di bawah ini, lalu *Paste* (Tempel) dan tekan **Run** di dalam Supabase SQL Editor.

```sql
-- ======================================================
-- 1. PEMBUATAN TABEL (SCHEMA)
-- ======================================================

create table if not exists customers (
  id text primary key,
  name text not null,
  nickname text,
  address text,
  package text,
  status text default 'aktif',
  due_date int,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists packages (
  id bigint primary key generated always as identity,
  name text not null,
  price bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists transactions (
  id text primary key,
  date timestamp with time zone not null,
  customer_name text,
  instansi_name text,
  package_name text,
  service_name text,
  price bigint not null,
  status text,
  payment_method text,
  amount_paid bigint,
  cashier_name text,
  type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

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

alter table company_settings add column if not exists api_monitoring_url text;
alter table company_settings add column if not exists api_monitoring_key text;
alter table company_settings add column if not exists api_monitoring_enabled boolean default false;

-- ======================================================
-- 2. KONFIGURASI KEAMANAN RLS (ROW LEVEL SECURITY)
-- ======================================================

-- Aktifkan RLS untuk semua tabel
alter table customers enable row level security;
alter table packages enable row level security;
alter table transactions enable row level security;
alter table company_settings enable row level security;

-- Hapus kebijakan lama jika sebelumnya pernah dibuat agar tidak error
drop policy if exists "Enable public access for customers" on customers;
drop policy if exists "Enable public access for packages" on packages;
drop policy if exists "Enable public access for transactions" on transactions;
drop policy if exists "Enable public access for company_settings" on company_settings;

-- Buat Kebijakan Publik (Membuka akses untuk Anon Key dari Vercel)
create policy "Enable public access for customers" 
on customers for all using (true) with check (true);

create policy "Enable public access for packages" 
on packages for all using (true) with check (true);

create policy "Enable public access for transactions" 
on transactions for all using (true) with check (true);

create policy "Enable public access for company_settings" 
on company_settings for all using (true) with check (true);


-- ======================================================
-- 3. MENGISI DATA AWAL (SEEDING)
-- ======================================================

insert into company_settings (id, name, admin_name, admin_fee)
values (1, 'KAsir NetSI', 'Admin Utama', 10000)
on conflict do nothing;

insert into packages (name, price)
values ('Paket Dasar 10Mbps', 150000), ('Paket Pro 20Mbps', 250000)
on conflict do nothing;

insert into customers (id, name, nickname, package, status, due_date)
values ('CUST-001', 'Contoh Pelanggan', 'Testing', 'Paket Dasar 10Mbps', 'aktif', 1)
on conflict do nothing;
```
