-- ==========================================
-- MIGRASI: Posisi admin (pelacakan lokasi untuk superadmin)
-- Jalankan SETELAH supabase_admin_invites.sql (butuh current_user_has_profile).
-- Aman dijalankan ulang.
-- ==========================================

-- Satu baris per admin: posisi terakhir yang dikirim aplikasi saat terbuka di HP admin.
create table if not exists admin_locations (
  admin_id uuid primary key references admin_profiles(id) on delete cascade,
  lat double precision not null check (lat >= -90 and lat <= 90),
  lng double precision not null check (lng >= -180 and lng <= 180),
  accuracy real,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table admin_locations enable row level security;

-- Lihat: superadmin melihat semua, admin hanya posisinya sendiri
drop policy if exists "locations select own or superadmin" on admin_locations;
create policy "locations select own or superadmin"
on admin_locations for select
using (admin_id = auth.uid() or current_role_is_superadmin());

-- Kirim/perbarui: hanya untuk dirinya sendiri (upsert butuh insert + update)
drop policy if exists "locations insert own" on admin_locations;
create policy "locations insert own"
on admin_locations for insert
with check (admin_id = auth.uid() and current_user_has_profile());

drop policy if exists "locations update own" on admin_locations;
create policy "locations update own"
on admin_locations for update
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

-- Hapus: hanya superadmin
drop policy if exists "locations delete superadmin" on admin_locations;
create policy "locations delete superadmin"
on admin_locations for delete
using (current_role_is_superadmin());
