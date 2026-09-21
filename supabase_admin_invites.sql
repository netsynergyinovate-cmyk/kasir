-- ==========================================
-- MIGRASI: Undangan admin lewat email + RLS diperketat
-- Jalankan SETELAH supabase_role_based_access.sql dan supabase_login_activity.sql.
-- Aman dijalankan ulang.
-- ==========================================

-- 1. Fungsi bantu: apakah pemanggil punya profil admin/superadmin.
-- Menggantikan cek longgar "auth.uid() is not null" (akun Google asing tidak boleh membaca data).
create or replace function public.current_user_has_profile()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admin_profiles where id = auth.uid());
$$;

-- 2. Tabel undangan admin (diisi langsung oleh superadmin dari aplikasi)
create table if not exists admin_invites (
  email text primary key check (email = lower(email) and email <> 'netsynergyinovate@gmail.com'),
  full_name text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table admin_invites enable row level security;

drop policy if exists "invites superadmin all" on admin_invites;
create policy "invites superadmin all"
on admin_invites for all
using (current_role_is_superadmin())
with check (current_role_is_superadmin());

-- 3. Klaim undangan saat login pertama: ubah undangan menjadi profil admin.
-- Hanya memakai email milik pemanggil di auth.users dan hanya jika email itu sudah terverifikasi.
create or replace function public.claim_invite()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_invite admin_invites%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;

  if exists (select 1 from admin_profiles where id = auth.uid()) then
    return true;
  end if;

  select lower(email) into v_email
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;

  if v_email is null then
    return false;
  end if;

  select * into v_invite from admin_invites where email = v_email;
  if not found then
    return false;
  end if;

  insert into admin_profiles (id, full_name, role, email)
  values (auth.uid(), v_invite.full_name, 'admin', v_email);

  delete from admin_invites where email = v_email;
  return true;
end;
$$;

revoke all on function public.claim_invite() from public;
grant execute on function public.claim_invite() to authenticated;

-- 4. Perketat RLS: SELECT/INSERT cukup untuk yang punya profil (bukan sekadar login)
drop policy if exists "customers select logged in" on customers;
create policy "customers select logged in" on customers for select using (current_user_has_profile());
drop policy if exists "customers insert logged in" on customers;
create policy "customers insert logged in" on customers for insert with check (current_user_has_profile());

drop policy if exists "transactions select logged in" on transactions;
create policy "transactions select logged in" on transactions for select using (current_user_has_profile());
drop policy if exists "transactions insert logged in" on transactions;
create policy "transactions insert logged in" on transactions for insert with check (current_user_has_profile());

drop policy if exists "packages select logged in" on packages;
create policy "packages select logged in" on packages for select using (current_user_has_profile());

drop policy if exists "company_settings select logged in" on company_settings;
create policy "company_settings select logged in" on company_settings for select using (current_user_has_profile());
