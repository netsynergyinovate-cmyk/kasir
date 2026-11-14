-- Pengaturan > Invoice Instansi: superadmin DAN admin boleh mengubah data invoice instansi (nama/kontak CS,
-- rekening bank, tagline). Policy tulis company_settings hanya untuk hak "settings.company", jadi lewat
-- fungsi security definer ini yang HANYA menulis kolom invoice_* (kolom toko lain tidak tersentuh).
-- Jalankan sekali di Supabase SQL Editor, SETELAH supabase_instansi_invoicing.sql.

alter table company_settings add column if not exists invoice_company_id text;
alter table company_settings add column if not exists invoice_cs_name text;
alter table company_settings add column if not exists invoice_cs_phone text;
alter table company_settings add column if not exists invoice_cs_email text;
alter table company_settings add column if not exists invoice_bank_name text;
alter table company_settings add column if not exists invoice_bank_account text;
alter table company_settings add column if not exists invoice_bank_holder text;

create or replace function public.save_instansi_invoice_settings(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admin_profiles where id = auth.uid() and role in ('admin', 'superadmin')) then
    raise exception 'Hanya admin atau superadmin yang boleh mengubah pengaturan invoice instansi.' using errcode = '42501';
  end if;

  update company_settings set
    invoice_company_id   = nullif(btrim(p ->> 'invoice_company_id'), ''),
    invoice_cs_name      = nullif(btrim(p ->> 'invoice_cs_name'), ''),
    invoice_cs_phone     = nullif(btrim(p ->> 'invoice_cs_phone'), ''),
    invoice_cs_email     = nullif(btrim(p ->> 'invoice_cs_email'), ''),
    invoice_bank_name    = nullif(btrim(p ->> 'invoice_bank_name'), ''),
    invoice_bank_account = nullif(btrim(p ->> 'invoice_bank_account'), ''),
    invoice_bank_holder  = nullif(btrim(p ->> 'invoice_bank_holder'), '')
  where id = 1;

  if not found then
    raise exception 'Baris company_settings (id = 1) belum ada.';
  end if;
end;
$$;

revoke all on function public.save_instansi_invoice_settings(jsonb) from public;
grant execute on function public.save_instansi_invoice_settings(jsonb) to authenticated;

notify pgrst, 'reload schema';
