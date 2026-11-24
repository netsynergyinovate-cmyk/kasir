-- ==========================================
-- MIGRASI: Start On Work (kerja lapangan admin)
-- Jalankan SETELAH supabase_customer_routes.sql. Aman dijalankan ulang.
-- ==========================================

-- 1. Hasil kunjungan "Lainnya" + catatan bebas
alter table customer_visits add column if not exists note text;
alter table customer_visits drop constraint if exists customer_visits_outcome_check;
alter table customer_visits add constraint customer_visits_outcome_check
  check (outcome in ('tidak_ada_di_rumah', 'uang_belum_ada', 'lainnya'));

-- 2. Log kerja: mulai, berangkat ke pelanggan, tiba, hasil laporan, bayar langsung, selesai
create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  admin_id uuid not null default auth.uid(),
  admin_name text,
  customer_id text references customers(id) on delete set null,
  customer_name text,
  event text not null check (event in ('mulai', 'berangkat', 'tiba', 'tidak_ada_di_rumah', 'uang_belum_ada', 'lainnya', 'bayar_langsung', 'selesai')),
  note text,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone not null default now()
);

create index if not exists work_logs_admin_idx on work_logs (admin_id, created_at desc);
create index if not exists work_logs_created_idx on work_logs (created_at desc);

alter table work_logs enable row level security;

-- Admin melihat log miliknya sendiri; superadmin melihat semua
drop policy if exists "work_logs select own or superadmin" on work_logs;
create policy "work_logs select own or superadmin"
on work_logs for select
using (admin_id = auth.uid() or current_role_is_superadmin());

-- Log hanya bisa ditambah atas nama sendiri, tidak bisa diubah/dihapus (jejak kerja)
drop policy if exists "work_logs insert own" on work_logs;
create policy "work_logs insert own"
on work_logs for insert
with check (current_user_has_profile() and admin_id = auth.uid());
