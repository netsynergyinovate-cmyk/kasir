-- ==========================================
-- MIGRASI: Integrasi WhatsApp (Watbiz)
-- Aman dijalankan ulang.
--
-- Token dipakai untuk mengirim pesan (reminder tagihan, invoice, dll) lewat API Watbiz
-- (https://app.watbiz.com/api/wa/send). Dipanggil lewat proxy Vercel Function
-- (api/watbiz/ping.js dst.) supaya token tidak perlu diketik ulang tiap kirim, dan supaya
-- request tidak diblokir CORS oleh browser.
-- ==========================================

alter table company_settings add column if not exists watbiz_token text default '';
alter table company_settings add column if not exists watbiz_enabled boolean default false;

notify pgrst, 'reload schema';
