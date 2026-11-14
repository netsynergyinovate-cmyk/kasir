import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Kolom company_settings yang tercetak di invoice/faktur instansi A4 (lihat mapProfile di Instansi.jsx).
const INVOICE_SETTING_FIELDS = [
  { key: 'invoice_company_id', label: 'Tagline / Slogan di Header', placeholder: 'Innovative Connections Everywhere' },
  { key: 'invoice_cs_name', label: 'Nama CS', placeholder: 'Nama petugas layanan pelanggan' },
  { key: 'invoice_cs_phone', label: 'No. WhatsApp CS', placeholder: '08xxxxxxxxxx', type: 'tel' },
  { key: 'invoice_cs_email', label: 'Email CS', placeholder: 'cs@perusahaan.com', type: 'email' },
  { key: 'invoice_bank_name', label: 'Nama Bank', placeholder: 'BRI / BCA / Mandiri' },
  { key: 'invoice_bank_account', label: 'No. Rekening', placeholder: '1234567890' },
  { key: 'invoice_bank_holder', label: 'Atas Nama Rekening', placeholder: 'PT NET SYNERGY INOVATE' },
];

const emptyForm = () => Object.fromEntries(INVOICE_SETTING_FIELDS.map((f) => [f.key, '']));

// Pengaturan dokumen invoice instansi, untuk superadmin & admin. Simpan lewat fungsi SQL
// save_instansi_invoice_settings (supabase_instansi_invoice_settings.sql) yang hanya menulis kolom
// invoice_*, jadi admin tidak perlu hak "settings.company" untuk baris company_settings.
const InstansiInvoiceSettingsPanel = () => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    supabase.from('company_settings').select(INVOICE_SETTING_FIELDS.map((f) => f.key).join(', ')).eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage({ ok: false, text: 'Gagal memuat: ' + error.message });
        else if (data) setForm((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, data[k] || ''])));
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    let { error } = await supabase.rpc('save_instansi_invoice_settings', { p: payload });
    if (error?.code === 'PGRST202') {
      // Fungsi SQL belum dipasang: coba tulis langsung (lolos RLS hanya untuk superadmin / hak settings.company).
      const res = await supabase.from('company_settings')
        .update(Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v || null])))
        .eq('id', 1).select('id');
      error = res.error || (res.data?.length ? null : {
        message: 'Akun ini belum bisa menyimpan. Jalankan supabase_instansi_invoice_settings.sql di Supabase SQL Editor.',
      });
    }
    setMessage(error ? { ok: false, text: 'Gagal menyimpan: ' + error.message } : { ok: true, text: 'Tersimpan. Berlaku untuk invoice & faktur yang dicetak berikutnya.' });
    setSaving(false);
  };

  if (loading) return <p className="text-center text-xs text-gray-400 italic py-10">Memuat...</p>;

  return (
    <form onSubmit={handleSave}>
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Invoice Instansi</h2>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <p className="text-[11px] text-gray-500 leading-snug">Data ini tercetak di invoice & faktur instansi (A4). Nama usaha, alamat, dan logo diambil dari tab Toko.</p>
        {INVOICE_SETTING_FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">{f.label}</label>
            <input
              id={f.key}
              name={f.key}
              type={f.type || 'text'}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
            />
          </div>
        ))}
        {message && (
          <p role="status" className={`text-xs font-semibold flex items-center gap-1.5 ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.ok && <CheckCircle2 size={14} />} {message.text}
          </p>
        )}
        <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Menyimpan...' : 'Simpan Pengaturan Invoice'}
        </button>
      </div>
    </form>
  );
};

export default InstansiInvoiceSettingsPanel;
