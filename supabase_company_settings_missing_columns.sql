-- ==========================================
-- MIGRASI: Lengkapi kolom company_settings yang hilang
-- Aman dijalankan ulang.
--
-- Aplikasi menyimpan pengaturan toko (termasuk logo) dengan satu upsert yang ikut mengirim
-- api_monitoring_url / api_monitoring_key / api_monitoring_enabled. Tiga kolom itu tidak ada di
-- tabel live, sehingga SELURUH upsert ditolak Supabase (PGRST204) dan logo/pengaturan tidak pernah
-- tersimpan ke database.
-- ==========================================

alter table company_settings add column if not exists api_monitoring_url text default '';
alter table company_settings add column if not exists api_monitoring_key text default '';
alter table company_settings add column if not exists api_monitoring_enabled boolean default false;

-- Muat ulang cache skema PostgREST supaya kolom baru langsung dikenali.
notify pgrst, 'reload schema';
