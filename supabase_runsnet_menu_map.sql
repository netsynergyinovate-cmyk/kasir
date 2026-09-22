-- ==========================================
-- MIGRASI: simpan peta menu Runsnet hasil temuan otomatis bersama sesi
-- Jalankan SETELAH supabase_runsnet_sync.sql. Aman dijalankan ulang.
--
-- Kunci navigasi Runsnet (nama & nilai parameter menu di index.php) TERNYATA berubah setiap sesi/hari,
-- bukan tetap seperti dikira sebelumnya. Nilai-nilai hardcode jadi basi dan gagal diam-diam (mengarah ke
-- halaman lain, bukan error). Sekarang ditemukan otomatis lewat menu resmi Runsnet sendiri tiap kali login,
-- lalu disimpan bersama cookie di sini supaya tidak perlu ditemukan ulang tiap pemanggilan.
-- ==========================================

alter table runsnet_session add column if not exists menu_map jsonb;
