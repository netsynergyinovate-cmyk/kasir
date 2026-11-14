-- Hak akses fitur granular per admin (dicentang superadmin di Pengaturan > Admin > Atur Akses).
-- Menggantikan policy tulis "khusus superadmin" supaya admin yang DIBERI hak akses terkait juga bisa.
-- Jalankan sekali di Supabase SQL Editor, SETELAH supabase_role_based_access.sql & supabase_admin_permissions.sql.

-- 1. Fungsi bantu: superadmin, atau admin yang allowed_paths.permissions-nya memuat p_permission.
create or replace function public.current_user_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_profiles
    where id = auth.uid()
      and (
        role = 'superadmin'
        or (jsonb_typeof(allowed_paths -> 'permissions') = 'array' and (allowed_paths -> 'permissions') ? p_permission)
      )
  );
$$;

grant execute on function public.current_user_has_permission(text) to authenticated;

-- 2. customers: edit (customers.edit, atau rute.reorder untuk urutan rute) & hapus (customers.delete),
--    tetap dibatasi ke pelanggan yang boleh dilihat admin itu.
drop policy if exists "customers update superadmin" on customers;
drop policy if exists "customers update permitted" on customers;
create policy "customers update permitted" on customers for update
using ((current_user_has_permission('customers.edit') or current_user_has_permission('rute.reorder')) and customer_visible_to_caller(id))
with check ((current_user_has_permission('customers.edit') or current_user_has_permission('rute.reorder')) and customer_visible_to_caller(id));

drop policy if exists "customers delete superadmin" on customers;
drop policy if exists "customers delete permitted" on customers;
create policy "customers delete permitted" on customers for delete
using (current_user_has_permission('customers.delete') and customer_visible_to_caller(id));

-- 3. transactions: hapus/batalkan (history.cancel).
drop policy if exists "transactions delete superadmin" on transactions;
drop policy if exists "transactions delete permitted" on transactions;
create policy "transactions delete permitted" on transactions for delete
using (current_user_has_permission('history.cancel'));

-- 4. packages: tambah/ubah/hapus paket (settings.packages).
drop policy if exists "packages write superadmin" on packages;
drop policy if exists "packages write permitted" on packages;
create policy "packages write permitted" on packages for all
using (current_user_has_permission('settings.packages'))
with check (current_user_has_permission('settings.packages'));

-- 5. company_settings: info toko & biaya admin (settings.company).
--    Catatan: RLS berlaku per baris, jadi admin ini secara teknis bisa menulis kolom lain di baris yang sama.
drop policy if exists "company_settings write superadmin" on company_settings;
drop policy if exists "company_settings write permitted" on company_settings;
create policy "company_settings write permitted" on company_settings for all
using (current_user_has_permission('settings.company'))
with check (current_user_has_permission('settings.company'));
