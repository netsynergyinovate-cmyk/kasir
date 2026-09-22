-- ==========================================
-- MIGRASI: fee kasir per-akun, akses menu per-admin, akses pelanggan per-admin
-- Jalankan SETELAH supabase_role_based_access.sql. Aman dijalankan ulang.
-- ==========================================

-- 1. Fee kasir (komisi) harus milik akun yang BENAR-BENAR memproses transaksi, bukan cuma nama teks
-- (yang bisa berubah/kosong). Transaksi yang dibuat superadmin otomatis tidak pernah cocok dengan id
-- admin manapun, jadi otomatis tidak terhitung sebagai komisi admin manapun.
alter table transactions add column if not exists cashier_id uuid;

-- 2. Menu/halaman apa saja yang boleh dibuka admin ini — null berarti "belum diatur", pakai daftar
-- bawaan (perilaku lama, semua admin sama) supaya admin yang sudah ada tidak tiba-tiba kehilangan akses.
-- Sudah diatur (array, walau kosong) berarti PERSIS itu saja yang boleh dibuka.
alter table admin_profiles add column if not exists allowed_paths jsonb;

-- 3. Pelanggan mana saja yang boleh dilihat/ditransaksikan admin ini. Admin TANPA baris di sini melihat
-- SEMUA pelanggan (perilaku lama, backward compatible). Begitu punya minimal 1 baris, admin itu HANYA
-- melihat pelanggan yang terdaftar di sini.
create table if not exists admin_customer_access (
  admin_id uuid not null references admin_profiles(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (admin_id, customer_id)
);

alter table admin_customer_access enable row level security;

drop policy if exists "admin customer access select own or superadmin" on admin_customer_access;
create policy "admin customer access select own or superadmin"
on admin_customer_access for select
using (admin_id = auth.uid() or current_role_is_superadmin());

drop policy if exists "admin customer access write superadmin" on admin_customer_access;
create policy "admin customer access write superadmin"
on admin_customer_access for all
using (current_role_is_superadmin())
with check (current_role_is_superadmin());

-- 4. Fungsi baca: pelanggan ini boleh dilihat pemanggil sekarang? Superadmin selalu boleh; admin tanpa
-- pembatasan (belum ada baris admin_customer_access sama sekali) boleh lihat semua; admin yang sudah
-- dibatasi hanya boleh lihat yang terdaftar untuknya.
create or replace function public.customer_visible_to_caller(p_customer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_role_is_superadmin()
    or not exists (select 1 from admin_customer_access where admin_id = auth.uid())
    or exists (select 1 from admin_customer_access where admin_id = auth.uid() and customer_id = p_customer_id);
$$;

grant execute on function public.customer_visible_to_caller(text) to authenticated;

-- 5. Terapkan ke RLS SELECT tabel customers (menggantikan policy select lama yang cuma cek profil).
drop policy if exists "customers select logged in" on customers;
create policy "customers select logged in"
on customers for select
using (current_user_has_profile() and customer_visible_to_caller(id));
