import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Archive, Save, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import InstansiA4Preview from './InstansiA4Preview';
import InstansiMultiPreviewModal from './InstansiMultiPreviewModal';
import { downloadInvoicesZip } from '../utils/instansiPdfExport';
import {
  generateInvoiceNumber, nextSequence, billingPeriod, resolvePackagePrice, monthRange, amountInWords,
} from '../utils/instansiInvoice';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Generator massal: terbitkan invoice bulanan untuk banyak klien sekaligus (mis. semua sekolah untuk
// Juli-September sekaligus). Alur: pilih klien+rentang bulan -> pratinjau daftar (belum disimpan) ->
// "Simpan Semua" (insert ke DB) -> "Unduh ZIP" (satu PDF per invoice).
const InstansiMultipate = ({ clients, profile, internetPackages, existingInvoiceNumbers, onCreatedMany, onClose }) => {
  const [selectedIds, setSelectedIds] = useState(new Set(clients.map((c) => c.id)));
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [method, setMethod] = useState('TRANSFER');
  const [status, setStatus] = useState('pending');

  const [drafts, setDrafts] = useState([]); // belum tersimpan
  const [saved, setSaved] = useState([]); // sudah tersimpan (row asli dari DB)
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const elRefs = useRef({});

  const toggleClient = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGenerate = () => {
    if (selectedIds.size === 0 || endMonth < startMonth) return;
    const months = monthRange(startMonth, endMonth);
    const list = [];
    clients.filter((c) => selectedIds.has(c.id)).forEach((client) => {
      const price = resolvePackagePrice(client.service_package, internetPackages);
      months.forEach((m) => {
        const period = billingPeriod(m, year);
        list.push({
          key: `${client.id}-${m}`,
          client,
          month: m,
          amount: price,
          status,
          method,
          ...period,
        });
      });
    });
    setDrafts(list);
    setSaved([]);
  };

  const handleSaveAll = async () => {
    if (drafts.length === 0) return;
    setSaving(true);
    let sequence = nextSequence(existingInvoiceNumbers, 'invoice');
    const results = [];
    for (const draft of drafts) {
      let inserted = null;
      for (let tries = 0; tries < 5 && !inserted; tries++) {
        const invoiceNumber = generateInvoiceNumber(sequence, draft.month, year, draft.client.client_code);
        const { data, error } = await supabase.from('instansi_invoices').insert({
          invoice_number: invoiceNumber,
          kind: 'invoice',
          client_id: draft.client.id,
          amount: draft.amount,
          status: draft.status,
          method: draft.method,
          issued_date: draft.issuedDate,
          due_date: draft.dueDate,
        }).select('*').single();
        sequence += 1;
        if (!error) inserted = { ...data, client: draft.client };
        else if (error.code !== '23505') break;
      }
      if (inserted) results.push(inserted);
    }
    setSaved(results);
    setSaving(false);
    onCreatedMany(results);
  };

  const invoicesForExport = saved.length > 0 ? saved : [];

  const handleDownloadZip = async () => {
    if (invoicesForExport.length === 0) return;
    setExporting(true);
    try {
      const items = invoicesForExport.map((inv) => ({
        el: elRefs.current[inv.id],
        invoiceNumber: inv.invoice_number,
        institutionName: inv.client.institution_name,
      })).filter((it) => it.el);
      await downloadInvoicesZip(items, (done, total, name) => setExportProgress(`${done}/${total} — ${name}`));
    } catch (err) {
      alert('Gagal membuat ZIP: ' + err.message);
    }
    setExporting(false);
    setExportProgress('');
  };

  const previewList = saved.length > 0 ? saved : drafts.map((d) => ({ ...d, invoice_number: `INV-XXX/${d.client.client_code}/NSI/.../${year}` }));

  // Dikelompokkan per klien (satu klien bisa punya beberapa bulan sekaligus) supaya daftar hasil
  // gampang ditelusuri, bukan ditumpuk rata per baris invoice.
  const groupedByClient = useMemo(() => {
    const map = new Map();
    previewList.forEach((item) => {
      const cid = item.client.id;
      if (!map.has(cid)) map.set(cid, { client: item.client, items: [], subtotal: 0 });
      const group = map.get(cid);
      group.items.push(item);
      group.subtotal += Number(item.amount) || 0;
    });
    return [...map.values()];
  }, [previewList]);

  const buildPreviewProps = (item) => {
    const client = item.client;
    const amount = item.amount;
    return {
      invoiceData: {
        institutionName: client.institution_name,
        clientId: client.client_code,
        servicePackage: client.service_package || 'NSI Standard',
        email: client.email,
        address: client.address,
        invoiceNumber: item.invoice_number,
        issuedDate: item.issued_date || item.issuedDate,
        dueDate: item.due_date || item.dueDate,
        method: item.method,
        status: item.status === 'paid' ? 'LUNAS' : 'PENDING',
        amountInWords: amountInWords(amount),
      },
      lineItems: [
        { type: 'Layanan', description: `NETWORK ${client.service_package || 'STANDARD'}`, price: amount },
        { type: 'Bulan', description: `${MONTHS[(item.month || 1) - 1]} (1 BULAN)`, price: 0 },
      ],
      subtotal: amount,
    };
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">Multipate — Terbitkan Massal</h3>
          <button type="button" onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-gray-700">Tutup</button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Bulan Mulai</label>
            <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Bulan Akhir</label>
            <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tahun</label>
            <input value={year} onChange={(e) => setYear(Number(e.target.value))} type="number" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-bold">
            <option value="TRANSFER">Transfer</option>
            <option value="TUNAI">Tunai</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-bold">
            <option value="pending">Belum Lunas</option>
            <option value="paid">Lunas</option>
          </select>
        </div>

        <div className="border border-gray-100 rounded-2xl p-2 max-h-48 overflow-y-auto space-y-1">
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-50 cursor-pointer text-xs">
              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleClient(c.id)} className="accent-blue-600" />
              <span className="font-bold text-gray-700 truncate">{c.institution_name} <span className="text-gray-400 font-normal">({c.client_code})</span></span>
            </label>
          ))}
        </div>

        <button type="button" onClick={handleGenerate} disabled={selectedIds.size === 0} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
          Buat Pratinjau ({selectedIds.size} klien × {Math.max(endMonth - startMonth + 1, 0)} bulan)
        </button>

        {previewList.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-gray-700">{previewList.length} dokumen {saved.length > 0 ? 'tersimpan' : 'siap diterbitkan'}</p>
              {saved.length === 0 ? (
                <button type="button" onClick={handleSaveAll} disabled={saving} className="flex items-center gap-1.5 text-xs font-black text-emerald-600 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Menyimpan...' : 'Simpan Semua'}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600"><CheckCircle2 size={14} /> Tersimpan</span>
              )}
            </div>

            {saved.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowPrintPreview(true)} className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <Printer size={16} /> Pratinjau & Cetak
                </button>
                <button type="button" onClick={handleDownloadZip} disabled={exporting} className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />} {exporting ? exportProgress || '...' : 'ZIP'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {groupedByClient.map((group) => (
                <div key={group.client.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-3 py-2.5 bg-gray-50 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-black text-gray-800 text-xs truncate">{group.client.institution_name}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{group.items.length} dokumen</p>
                    </div>
                    <p className="font-black text-gray-900 text-xs shrink-0">Rp {new Intl.NumberFormat('id-ID').format(group.subtotal)}</p>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {group.items.map((item) => (
                      <li key={item.key || item.id} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <p className="font-mono text-gray-500 text-[10px] truncate">{item.invoice_number}</p>
                          <p className="text-gray-400 text-[10px]">{MONTHS[(item.month || 1) - 1]}</p>
                        </div>
                        <p className="font-bold text-gray-700 shrink-0">Rp {new Intl.NumberFormat('id-ID').format(item.amount)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPrintPreview && saved.length > 0 && (
        <InstansiMultiPreviewModal
          items={saved.map((inv) => ({ key: inv.id, ...buildPreviewProps({ ...inv, month: new Date(inv.issued_date).getMonth() + 1 }) }))}
          profile={profile}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* Render off-screen (tak terlihat) untuk sumber rasterisasi ZIP — hanya dokumen yang sudah tersimpan. */}
      <div className="fixed left-0 top-[300vh] pointer-events-none w-[210mm]">
        {saved.map((inv) => {
          const props = buildPreviewProps({ ...inv, month: new Date(inv.issued_date).getMonth() + 1 });
          return (
            <div key={inv.id} ref={(el) => { elRefs.current[inv.id] = el; }}>
              <InstansiA4Preview invoiceData={props.invoiceData} lineItems={props.lineItems} subtotal={props.subtotal} profile={profile} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InstansiMultipate;
