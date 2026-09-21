-- ==========================================
-- MIGRASI: Role-Based Access (Superadmin vs Admin) + Device Lock
-- Tanggal: 2026-09-21
-- Jalankan seluruh isi file ini di Supabase SQL Editor, satu kali.
-- ==========================================

-- 1. Tabel admin_profiles (terhubung ke auth.users bawaan Supabase Auth)
create table if not exists admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'superadmin')),
  device_id text,
  device_label text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 2. Fungsi bantu: cek apakah pemanggil saat ini superadmin.
-- security definer supaya bisa membaca admin_profiles tanpa terjebak RLS-nya sendiri.
create or replace function public.current_role_is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

-- 3. RLS: admin_profiles
alter table admin_profiles enable row level security;

drop policy if exists "profiles select own or superadmin all" on admin_profiles;
create policy "profiles select own or superadmin all"
on admin_profiles for select
using (id = auth.uid() or current_role_is_superadmin());

drop policy if exists "profiles superadmin update any" on admin_profiles;
create policy "profiles superadmin update any"
on admin_profiles for update
using (current_role_is_superadmin())
with check (current_role_is_superadmin());

-- Catatan: sengaja tidak ada policy INSERT/DELETE untuk admin_profiles dari sisi client.
-- Pembuatan akun admin baru hanya lewat Vercel Function yang pakai service_role key
-- (service_role otomatis melewati RLS, lihat Task 11).

-- 4. RLS: customers
alter table customers enable row level security;
drop policy if exists "Enable public access for customers" on customers;
drop policy if exists "customers select logged in" on customers;
create policy "customers select logged in" on customers for select using (auth.uid() is not null);
drop policy if exists "customers insert logged in" on customers;
create policy "customers insert logged in" on customers for insert with check (auth.uid() is not null);
drop policy if exists "customers update superadmin" on customers;
create policy "customers update superadmin" on customers for update using (current_role_is_superadmin()) with check (current_role_is_superadmin());
drop policy if exists "customers delete superadmin" on customers;
create policy "customers delete superadmin" on customers for delete using (current_role_is_superadmin());

-- 5. RLS: transactions
alter table transactions enable row level security;
drop policy if exists "Enable public access for transactions" on transactions;
drop policy if exists "transactions select logged in" on transactions;
create policy "transactions select logged in" on transactions for select using (auth.uid() is not null);
drop policy if exists "transactions insert logged in" on transactions;
create policy "transactions insert logged in" on transactions for insert with check (auth.uid() is not null);
drop policy if exists "transactions update superadmin" on transactions;
create policy "transactions update superadmin" on transactions for update using (current_role_is_superadmin()) with check (current_role_is_superadmin());
drop policy if exists "transactions delete superadmin" on transactions;
create policy "transactions delete superadmin" on transactions for delete using (current_role_is_superadmin());

-- 6. RLS: packages (select untuk semua yang login, insert/update/delete superadmin saja)
alter table packages enable row level security;
drop policy if exists "Enable public access for packages" on packages;
drop policy if exists "packages select logged in" on packages;
create policy "packages select logged in" on packages for select using (auth.uid() is not null);
drop policy if exists "packages write superadmin" on packages;
create policy "packages write superadmin" on packages for all using (current_role_is_superadmin()) with check (current_role_is_superadmin());

-- 7. RLS: company_settings (select untuk semua yang login, tulis superadmin saja)
alter table company_settings enable row level security;
drop policy if exists "Enable public access for company_settings" on company_settings;
drop policy if exists "company_settings select logged in" on company_settings;
create policy "company_settings select logged in" on company_settings for select using (auth.uid() is not null);
drop policy if exists "company_settings write superadmin" on company_settings;
create policy "company_settings write superadmin" on company_settings for all using (current_role_is_superadmin()) with check (current_role_is_superadmin());

-- 8. RLS: ping_logs — SENGAJA tetap terbuka penuh.
-- Dipakai oleh GitHub Actions (scripts/ping-supabase.js) & keep-alive client (src/lib/supabase.js)
-- TANPA login Supabase Auth. Tabel ini tidak menyimpan data sensitif (cuma timestamp+source).
alter table ping_logs enable row level security;
drop policy if exists "Enable public access for ping_logs" on ping_logs;
drop policy if exists "ping_logs public access" on ping_logs;
create policy "ping_logs public access" on ping_logs for all using (true) with check (true);
