-- PIN buka aplikasi PER AKUN (admin & superadmin), menggantikan satu PIN bersama untuk semua akun.
-- Akun yang belum mengatur PIN sendiri tetap memakai PIN bersama lama (company_settings.app_pin).
-- PIN disimpan apa adanya (bukan hash) supaya superadmin bisa melihat PIN tiap admin di Pengaturan > Admin.
-- Hanya pemilik akun dan superadmin yang bisa membacanya (policy "profiles select own or superadmin all").
-- Jalankan sekali di Supabase SQL Editor, SETELAH supabase_role_based_access.sql. Aman dijalankan ulang.

alter table admin_profiles add column if not exists app_pin text;

-- Ubah PIN: akun sendiri, atau akun mana pun kalau pemanggilnya superadmin. PIN wajib 6 angka;
-- kosong/null = hapus PIN akun itu (kembali ke PIN bersama).
create or replace function public.set_admin_pin(p_admin_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text := nullif(btrim(p_pin), '');
begin
  if auth.uid() is null then
    raise exception 'Belum login.';
  end if;
  if p_admin_id <> auth.uid() and not exists (select 1 from admin_profiles where id = auth.uid() and role = 'superadmin') then
    raise exception 'Hanya superadmin yang boleh mengubah PIN akun lain.' using errcode = '42501';
  end if;
  if v_pin is not null and v_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN harus 6 angka.';
  end if;

  update admin_profiles set app_pin = v_pin where id = p_admin_id;
end;
$$;

revoke all on function public.set_admin_pin(uuid, text) from public;
grant execute on function public.set_admin_pin(uuid, text) to authenticated;

notify pgrst, 'reload schema';
