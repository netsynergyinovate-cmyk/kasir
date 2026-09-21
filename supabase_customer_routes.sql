-- ==========================================
-- MIGRASI: Rute kunjungan pelanggan (koordinat, urutan rute, catatan kunjungan)
-- Jalankan SETELAH supabase_admin_invites.sql (butuh fungsi current_user_has_profile).
-- Aman dijalankan ulang.
-- ==========================================

-- 1. Koordinat rumah dan urutan rute pada tabel pelanggan.
-- Hanya superadmin yang boleh mengubahnya (policy UPDATE customers sudah khusus superadmin).
alter table customers add column if not exists lat double precision;
alter table customers add column if not exists lng double precision;
alter table customers add column if not exists route_order integer;

alter table customers drop constraint if exists customers_lat_range;
alter table customers add constraint customers_lat_range check (lat is null or (lat >= -90 and lat <= 90));
alter table customers drop constraint if exists customers_lng_range;
alter table customers add constraint customers_lng_range check (lng is null or (lng >= -180 and lng <= 180));

-- 2. Catatan kunjungan admin ke rumah pelanggan
create table if not exists customer_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references customers(id) on delete cascade,
  outcome text not null check (outcome in ('tidak_ada_di_rumah', 'uang_belum_ada')),
  available_on date,
  visited_by uuid not null default auth.uid(),
  visited_by_name text,
  visited_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists customer_visits_customer_idx on customer_visits (customer_id, visited_at desc);

alter table customer_visits enable row level security;

-- Semua akun ber-profil boleh melihat
drop policy if exists "visits select with profile" on customer_visits;
create policy "visits select with profile"
on customer_visits for select
using (current_user_has_profile());

-- Admin/superadmin hanya boleh menambah catatan atas nama dirinya sendiri
drop policy if exists "visits insert own" on customer_visits;
create policy "visits insert own"
on customer_visits for insert
with check (current_user_has_profile() and visited_by = auth.uid());

-- Koreksi/hapus catatan hanya superadmin
drop policy if exists "visits update superadmin" on customer_visits;
create policy "visits update superadmin"
on customer_visits for update
using (current_role_is_superadmin())
with check (current_role_is_superadmin());

drop policy if exists "visits delete superadmin" on customer_visits;
create policy "visits delete superadmin"
on customer_visits for delete
using (current_role_is_superadmin());
