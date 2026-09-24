-- Migrasi: Tabel Relasional Riwayat Komisi Admin
-- Catatan: Sistem KAsir tetap berjalan via hybrid JSONB admin_profiles.allowed_paths
-- Tabel ini adalah pendamping relasional untuk reporting enterprise dan audit trail.

create table if not exists admin_commissions (
  id text primary key,
  admin_id uuid not null references admin_profiles(id) on delete cascade,
  admin_name text not null,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'Transfer Bank',
  notes text,
  status text not null default 'TERKIRIM',
  sent_by_name text not null default 'Super Admin',
  sent_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Index performa pencarian komisi per-admin dan per-tanggal
create index if not exists idx_admin_commissions_admin_id on admin_commissions(admin_id);
create index if not exists idx_admin_commissions_sent_at on admin_commissions(sent_at desc);

-- Aktifkan Row Level Security (RLS)
alter table admin_commissions enable row level security;

-- Policy: Admin hanya bisa melihat komisi miliknya sendiri
create policy "Admin can view own commissions"
  on admin_commissions for select
  using (
    auth.uid() = admin_id or
    exists (
      select 1 from admin_profiles
      where admin_profiles.id = auth.uid() and admin_profiles.role = 'superadmin'
    )
  );

-- Policy: Super Admin berhak insert dan update komisi
create policy "Superadmin can manage commissions"
  on admin_commissions for all
  using (
    exists (
      select 1 from admin_profiles
      where admin_profiles.id = auth.uid() and admin_profiles.role = 'superadmin'
    )
  );
