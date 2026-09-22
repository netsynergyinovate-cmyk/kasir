-- ==========================================
-- MIGRASI: Invoice Instansi (menggantikan alur lama transactions type='instansi')
-- Aman dijalankan ulang.
--
-- Menyatukan fitur aplikasi invoicing terpisah (AppInvoce/edubill-pro) ke database KAsir
-- ("satu pintu"): daftar klien instansi, invoice tagihan (INV-...), faktur pembayaran (FKT-...),
-- dan profil perusahaan khusus untuk dokumen invoice (rekening bank, kontak CS, daftar paket).
-- ==========================================

create table if not exists instansi_clients (
  id bigint primary key generated always as identity,
  client_code text not null unique, -- kode klien pendek, dipakai di nomor invoice (mis. "SDN01")
  institution_name text not null,
  email text,
  service_package text,
  address text,
  status text default 'active', -- 'active' | 'inactive'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists instansi_invoices (
  id bigint primary key generated always as identity,
  invoice_number text not null unique,
  kind text not null default 'invoice', -- 'invoice' (tagihan) | 'faktur' (bukti pembayaran)
  client_id bigint references instansi_clients(id) on delete set null,
  amount numeric(12, 2) not null,
  status text not null default 'pending', -- 'pending' | 'paid'
  method text default 'TRANSFER', -- 'TRANSFER' | 'TUNAI'
  issued_date date not null,
  due_date date,
  issuance_place text,
  issuance_date text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists instansi_invoices_client_id_idx on instansi_invoices(client_id);

-- Kolom tambahan di company_settings khusus untuk dokumen invoice instansi (nama toko, alamat,
-- dan logo dipakai bersama dengan struk retail lewat kolom name/address/logo_url yang sudah ada).
alter table company_settings add column if not exists invoice_company_id text; -- tagline/slogan di header invoice
alter table company_settings add column if not exists invoice_cs_name text;
alter table company_settings add column if not exists invoice_cs_phone text;
alter table company_settings add column if not exists invoice_cs_email text;
alter table company_settings add column if not exists invoice_bank_name text;
alter table company_settings add column if not exists invoice_bank_account text;
alter table company_settings add column if not exists invoice_bank_holder text;
alter table company_settings add column if not exists invoice_internet_packages jsonb default '[]'::jsonb; -- [{name, price}]

-- Sama seperti tabel inti lainnya di aplikasi ini (customers, transactions, company_settings):
-- RLS dimatikan karena akses diatur lewat lapisan aplikasi, bukan Supabase Auth per baris.
alter table instansi_clients disable row level security;
alter table instansi_invoices disable row level security;

notify pgrst, 'reload schema';
