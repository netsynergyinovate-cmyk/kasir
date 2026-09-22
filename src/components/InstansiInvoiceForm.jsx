import { useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  generateInvoiceNumber, generateFakturNumber, nextSequence, billingPeriod, resolvePackagePrice,
} from '../utils/instansiInvoice';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Terbitkan satu invoice (kind='invoice') atau faktur (kind='faktur') untuk satu klien. Nomor dokumen
// dihitung dari urutan tertinggi yang sudah dipakai (existingInvoiceNumbers, dikirim parent supaya
// selalu terbaru) lalu langsung disimpan ke instansi_invoices; kalau bentrok nomor (dua admin
// menerbitkan bersamaan), otomatis dicoba lagi dengan urutan berikutnya.
const InstansiInvoiceForm = ({ kind, clients, internetPackages, existingInvoiceNumbers, onClose, onCreated }) => {
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [method, setMethod] = useState('TRANSFER');
  const [status, setStatus] = useState('pending');
  const [issuancePlace, setIssuancePlace] = useState('');
  const [issuanceDate, setIssuanceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const client = clients.find((c) => c.id === Number(clientId));
  const defaultPrice = client ? resolvePackagePrice(client.service_package, internetPackages) : 0;
  const [amount, setAmount] = useState(defaultPrice);

  const period = useMemo(() => billingPeriod(month, year), [month, year]);
  const previewNumber = useMemo(() => {
    if (!client) return '';
    return kind === 'faktur'
      ? `FKT-XXX-${client.client_code}-NSI-${MONTHS[month - 1]?.slice(0, 3) || ''}-${year}`
      : `INV-XXX/${client.client_code}/NSI/.../${year}`;
  }, [client, kind, month, year]);

  const handleClientChange = (e) => {
    const id = e.target.value;
    setClientId(id);
    const c = clients.find((cc) => cc.id === Number(id));
    setAmount(c ? resolvePackagePrice(c.service_package, internetPackages) : 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!client) {
      setError('Pilih klien terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError('');

    let attempt = nextSequence(existingInvoiceNumbers, kind);
    for (let tries = 0; tries < 5; tries++) {
      const invoiceNumber = kind === 'faktur'
        ? generateFakturNumber(attempt, month, year, client.client_code)
        : generateInvoiceNumber(attempt, month, year, client.client_code);

      const payload = {
        invoice_number: invoiceNumber,
        kind,
        client_id: client.id,
        amount,
        status,
        method,
        issued_date: period.issuedDate,
        due_date: period.dueDate,
        issuance_place: issuancePlace || null,
        issuance_date: issuanceDate || null,
      };

      const { data, error: insertError } = await supabase.from('instansi_invoices').insert(payload).select('*').single();
      if (!insertError) {
        onCreated({ ...data, client });
        setSaving(false);
        return;
      }
      if (insertError.code === '23505') { attempt += 1; continue; } // nomor bentrok, coba urutan berikutnya
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setError('Gagal menemukan nomor dokumen yang belum dipakai. Coba lagi.');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
          <X size={18} />
        </button>
        <div>
          <h3 className="text-lg font-black text-gray-900">{kind === 'faktur' ? 'Terbitkan Faktur' : 'Terbitkan Invoice'}</h3>
          <p className="text-[11px] text-gray-400 font-mono">{previewNumber || '-'}</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Klien</label>
          <select value={clientId} onChange={handleClientChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
            {clients.length === 0 && <option value="">Belum ada klien</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.institution_name} ({c.client_code})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Bulan</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tahun</label>
            <input value={year} onChange={(e) => setYear(Number(e.target.value))} type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nominal Tagihan (Rp)</label>
          <input value={amount} onChange={(e) => setAmount(Number(e.target.value))} type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Metode</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
              <option value="TRANSFER">Transfer</option>
              <option value="TUNAI">Tunai</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
              <option value="pending">Belum Lunas</option>
              <option value="paid">Lunas</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tempat Terbit</label>
            <input value={issuancePlace} onChange={(e) => setIssuancePlace(e.target.value)} type="text" placeholder="Mukomuko" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tgl Terbit</label>
            <input value={issuanceDate} onChange={(e) => setIssuanceDate(e.target.value)} type="date" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

        <button type="submit" disabled={saving || !client} className="w-full py-3.5 rounded-xl bg-gray-900 hover:bg-black text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Menerbitkan...' : `Terbitkan ${kind === 'faktur' ? 'Faktur' : 'Invoice'}`}
        </button>
      </form>
    </div>
  );
};

export default InstansiInvoiceForm;
