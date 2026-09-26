-- ==========================================
-- MIGRASI: Kunci device MANUAL oleh superadmin (ganti auto-lock login pertama)
-- Jalankan SETELAH supabase_login_activity.sql. Aman dijalankan ulang.
--
-- Sebelumnya: device_id admin terkunci OTOMATIS pas login pertama. Sekarang: admin & superadmin
-- bebas login dari device manapun sampai superadmin sendiri menekan tombol "Kunci" di panel Akun
-- Admin (mengunci ke device LOGIN TERAKHIR admin itu, direkam di last_login_device_id).
-- ==========================================

alter table admin_profiles add column if not exists last_login_device_id text;

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
    last_login_device_id = p_device_id,
    last_login_location = p_location,
    last_login_ip = p_ip
  where id = auth.uid();
end;
$$;

revoke all on function public.record_login(text, text, text, text) from public;
grant execute on function public.record_login(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
