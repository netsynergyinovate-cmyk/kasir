-- ==========================================
-- MIGRASI: Setiap admin/superadmin bisa mengatur nama tampilannya sendiri
-- Jalankan SETELAH supabase_role_based_access.sql. Aman dijalankan ulang.
--
-- Sebelumnya "Nama Kasir di Struk" di Settings adalah SATU field bersama (company_settings.admin_name),
-- hanya bisa diubah superadmin — semua admin lain terpaksa memakai nama yang sama atau nama generik
-- ("Super Admin"/"Admin Kasir"). Fungsi ini membiarkan tiap akun mengubah admin_profiles.full_name milik
-- SENDIRI saja (security definer + auth.uid(), bukan UPDATE langsung — supaya admin tidak bisa iseng
-- mengubah kolom lain seperti role lewat RLS yang longgar).
-- ==========================================

create or replace function public.update_my_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_full_name), '');
begin
  if auth.uid() is null then
    raise exception 'Belum login.';
  end if;
  if v_name is null then
    raise exception 'Nama tidak boleh kosong.';
  end if;

  update admin_profiles set full_name = v_name where id = auth.uid();
end;
$$;

revoke all on function public.update_my_name(text) from public;
grant execute on function public.update_my_name(text) to authenticated;
