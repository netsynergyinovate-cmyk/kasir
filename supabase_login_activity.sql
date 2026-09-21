-- ==========================================
-- MIGRASI: Aktivitas login (last login, device, lokasi) + perbaikan device-lock
-- Jalankan SETELAH supabase_role_based_access.sql. Aman dijalankan ulang.
-- ==========================================

alter table admin_profiles add column if not exists email text;
alter table admin_profiles add column if not exists last_login_at timestamp with time zone;
alter table admin_profiles add column if not exists last_login_device text;
alter table admin_profiles add column if not exists last_login_location text;
alter table admin_profiles add column if not exists last_login_ip text;

-- Isi email untuk akun yang sudah ada
update admin_profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Fungsi pencatat login. security definer karena policy UPDATE admin_profiles hanya untuk
-- superadmin; fungsi ini cuma boleh mengisi kolom login dan device_id yang MASIH KOSONG milik
-- pemanggil sendiri (auth.uid()), tidak bisa mengubah role atau device yang sudah terkunci.
create or replace function public.record_login(
  p_device_id text,
  p_device_label text,
  p_location text,
  p_ip text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update admin_profiles
  set
    last_login_at = now(),
    last_login_device = p_device_label,
    last_login_location = p_location,
    last_login_ip = p_ip,
    device_id = case when role = 'admin' and device_id is null then p_device_id else device_id end,
    device_label = case when role = 'admin' and device_id is null then p_device_label else device_label end
  where id = auth.uid();
end;
$$;

revoke all on function public.record_login(text, text, text, text) from public;
grant execute on function public.record_login(text, text, text, text) to authenticated;
