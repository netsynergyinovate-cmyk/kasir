-- ==========================================
-- MIGRASI: Opsi kecualikan superadmin dari kunci otomatis 15 menit
-- Aman dijalankan ulang.
--
-- Dipakai saat sedang develop/testing supaya superadmin tidak ikut terkunci tiap 15 menit idle;
-- akun admin tetap terkunci seperti biasa (demi keamanan kasir di lapangan).
-- ==========================================

alter table company_settings add column if not exists idle_lock_exempt_superadmin boolean default false;

notify pgrst, 'reload schema';
