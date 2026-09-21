-- ==========================================
-- Buat user netsynergyinovate@gmail.com + jadikan superadmin (satu-satunya).
-- Butuh kolom admin_profiles.email (dari supabase_login_activity.sql). Aman dijalankan ulang.
-- ==========================================

-- 1. Buat user di auth.users jika belum ada (password acak, tidak dipakai; login lewat Google)
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = 'netsynergyinovate@gmail.com';

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'netsynergyinovate@gmail.com', crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', 'netsynergyinovate@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- 2. Daftarkan sebagai superadmin
insert into admin_profiles (id, full_name, role, email)
select id, 'Super Administrator', 'superadmin', email
from auth.users
where lower(email) = 'netsynergyinovate@gmail.com'
on conflict (id) do update set role = 'superadmin', full_name = 'Super Administrator', email = excluded.email;

-- 3. Database menolak superadmin selain email itu
alter table admin_profiles drop constraint if exists only_owner_is_superadmin;
alter table admin_profiles add constraint only_owner_is_superadmin
  check (role <> 'superadmin' or lower(email) = 'netsynergyinovate@gmail.com');

-- 4. Verifikasi: harus 1 baris superadmin dengan email di atas
select email, role, full_name from admin_profiles order by role;
