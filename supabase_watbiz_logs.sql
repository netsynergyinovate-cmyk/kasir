-- ==========================================
-- MIGRASI: Riwayat pesan WhatsApp (Watbiz)
-- Aman dijalankan ulang.
--
-- Mencatat setiap pesan yang dikirim lewat integrasi Watbiz (tes koneksi, nanti juga reminder
-- tagihan/invoice) supaya kelihatan di tab WhatsApp Pengaturan — siapa dikirimi apa, kapan, berhasil
-- atau tidak.
-- ==========================================

create table if not exists watbiz_logs (
  id bigint primary key generated always as identity,
  sent_at timestamp with time zone default timezone('utc'::text, now()),
  phone_number text not null,
  message text,
  kind text default 'test', -- 'test' | 'reminder' | 'invoice' dst.
  status text not null, -- 'success' | 'failed'
  response_detail text,
  sender_name text, -- nama admin/superadmin yang memicu pengiriman
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists watbiz_logs_sent_at_idx on watbiz_logs(sent_at desc);

alter table watbiz_logs disable row level security;

notify pgrst, 'reload schema';
