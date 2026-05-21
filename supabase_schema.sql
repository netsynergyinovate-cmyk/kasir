-- Tabel Pelanggan
create table if not exists customers (
  id text primary key,
  name text not null,
  address text,
  package text,
  status text default 'aktif',
  due_date int,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabel Paket Internet
create table if not exists packages (
  id bigint primary key generated always as identity,
  name text not null,
  price bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabel Transaksi
create table if not exists transactions (
  id text primary key,
  date timestamp with time zone not null,
  customer_name text,
  instansi_name text,
  package_name text,
  service_name text,
  price bigint not null,
  status text,
  payment_method text,
  amount_paid bigint,
  cashier_name text,
  type text not null, -- 'retail' atau 'instansi'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabel Pengaturan Perusahaan
create table if not exists company_settings (
  id int primary key default 1,
  name text,
  address text,
  phone text,
  logo_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Matikan RLS untuk testing (SANGAT DISARANKAN diaktifkan kembali nanti dengan Auth)
alter table customers disable row level security;
alter table packages disable row level security;
alter table transactions disable row level security;
alter table company_settings disable row level security;

-- PUSH DATA AWAL (SEEDING) --

-- Masukkan Data Perusahaan Awal
insert into company_settings (id, name, address, phone)
values (1, 'PT Net Synergy Inovate', 'Jl. Teknologi Canggih No. 99, Jakarta', '0812-3456-7890')
on conflict (id) do nothing;

-- Masukkan Data Paket Internet
insert into packages (name, price)
values 
  ('Paket RT RW 10Mbps', 150000),
  ('Paket RT RW 20Mbps', 250000),
  ('Paket Pro 50Mbps', 400000);

-- Masukkan Data Pelanggan Awal
insert into customers (id, name, address, package, status, due_date)
values 
  ('CUST-001', 'Budi Santoso', 'Jl. Merdeka No.10', 'Paket RT RW 10Mbps', 'aktif', 15),
  ('CUST-002', 'Siti Aminah', 'Perum Asri Blok B2', 'Paket RT RW 20Mbps', 'isolir', 5),
  ('CUST-003', 'Warung Kopi Berkah', 'Jl. Sudirman 45', 'Paket Pro 50Mbps', 'aktif', 1);
