-- ==========================================
-- MIGRASI: Push notification pengingat Start On Work
-- Jalankan SETELAH supabase_start_on_work.sql. Aman dijalankan ulang.
-- ==========================================

-- 1. Perangkat yang terdaftar untuk push (satu baris per browser/HP)
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references admin_profiles(id) on delete cascade,
  subscription jsonb not null,
  updated_at timestamp with time zone not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "push select own" on push_subscriptions;
create policy "push select own" on push_subscriptions for select using (user_id = auth.uid());

drop policy if exists "push insert own" on push_subscriptions;
create policy "push insert own" on push_subscriptions for insert
with check (user_id = auth.uid() and current_user_has_profile());

drop policy if exists "push update own" on push_subscriptions;
create policy "push update own" on push_subscriptions for update
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push delete own" on push_subscriptions;
create policy "push delete own" on push_subscriptions for delete using (user_id = auth.uid());

-- 2. Event 'pengingat' di log kerja: dicatat skrip terjadwal saat admin 1 jam tanpa aktivitas,
--    supaya superadmin melihatnya di Log Kerja.
alter table work_logs drop constraint if exists work_logs_event_check;
alter table work_logs add constraint work_logs_event_check
  check (event in ('mulai', 'berangkat', 'tiba', 'tidak_ada_di_rumah', 'uang_belum_ada', 'bayar_langsung', 'selesai', 'pengingat'));
