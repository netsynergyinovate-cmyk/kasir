-- ==========================================
-- Kunci superadmin: HANYA netsynergyinovate@gmail.com
-- Jalankan SETELAH supabase_login_activity.sql (butuh kolom email). Aman dijalankan ulang.
-- ==========================================

-- 1. Daftarkan akun tersebut sebagai superadmin (0 baris jika akunnya belum ada di auth.users)
insert into admin_profiles (id, full_name, role, email)
select id, 'Super Administrator', 'superadmin', email
from auth.users
where lower(email) = 'netsynergyinovate@gmail.com'
on conflict (id) do update set role = 'superadmin', full_name = 'Super Administrator', email = excluded.email;

-- 2. Database menolak superadmin selain email itu (berlaku juga untuk update dan insert manual)
alter table admin_profiles drop constraint if exists only_owner_is_superadmin;
alter table admin_profiles add constraint only_owner_is_superadmin
  check (role <> 'superadmin' or lower(email) = 'netsynergyinovate@gmail.com');

-- 3. Verifikasi: harus 1 baris superadmin dengan email di atas
select email, role, full_name from admin_profiles order by role;
