-- ==========================================
-- MIGRASI: Sinkronisasi pembayaran KAsir -> Runsnet
-- Jalankan SETELAH supabase_role_based_access.sql. Aman dijalankan ulang.
-- ==========================================

-- 1. Saklar di company_settings: default MATI. Baru dianggap "hidup sungguhan" kalau
-- runsnet_sync_enabled = true DAN runsnet_dry_run = false.
alter table company_settings add column if not exists runsnet_sync_enabled boolean not null default false;
alter table company_settings add column if not exists runsnet_dry_run boolean not null default true;

-- 2. Log tiap percobaan sinkron. unique(transaction_id) mencegah 1 transaksi terkirim dua kali
-- walau webhook Supabase memanggil lebih dari sekali (retry jaringan, dll).
create table if not exists runsnet_sync_log (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null,
  status text not null check (status in ('success', 'failed', 'skipped_not_configured', 'skipped_disabled', 'dry_run')),
  search_query text,
  runsnet_ref text,
  message text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (transaction_id)
);

alter table runsnet_sync_log enable row level security;

-- Dibaca superadmin (panel log di Settings). Ditulis HANYA oleh Vercel Function lewat
-- service_role (service_role melewati RLS), jadi sengaja tidak ada policy insert/update untuk client.
drop policy if exists "runsnet log select superadmin" on runsnet_sync_log;
create policy "runsnet log select superadmin"
on runsnet_sync_log for select
using (current_role_is_superadmin());

-- 3. Sesi login Runsnet tersimpan (cookie), dipakai ulang antar pemanggilan Vercel Function
-- (function serverless tidak "tetap login" seperti browser) supaya tidak login berulang-ulang
-- tiap transaksi, yang bisa memicu proteksi anti-bot Runsnet.
create table if not exists runsnet_session (
  id smallint primary key default 1,
  cookie text,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint runsnet_session_singleton check (id = 1)
);

alter table runsnet_session enable row level security;
-- Tidak ada policy sama sekali untuk client: hanya service_role (Vercel Function) yang boleh baca/tulis.
