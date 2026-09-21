-- ==========================================
-- MIGRASI: Bukti screenshot pembayaran Runsnet
-- Jalankan SETELAH supabase_role_based_access.sql. Aman dijalankan ulang.
--
-- Satu screenshot bukti (status PAID di Runsnet) per transaksi. Disimpan di tabel terpisah supaya daftar
-- transaksi yang dimuat tiap aplikasi dibuka tidak ikut membawa data gambar. Dibaca semua akun yang login;
-- ditulis HANYA lewat Vercel Function (api/runsnet/save-proof.js, service_role), jadi tidak ada policy tulis.
-- ==========================================

create table if not exists runsnet_proofs (
  transaction_id text primary key,
  image text not null,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table runsnet_proofs enable row level security;

drop policy if exists "runsnet proofs select logged in" on runsnet_proofs;
create policy "runsnet proofs select logged in"
on runsnet_proofs for select
using (auth.uid() is not null);

notify pgrst, 'reload schema';
