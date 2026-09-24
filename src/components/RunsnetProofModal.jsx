import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ImagePlus, Loader2, Send, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resizeImageFile } from '../utils/imageResize';
import { describeRunsnetStatus, isRunsnetMismatch, runsnetCodeOf } from '../utils/runsnetStatus';
import { formatRupiah } from '../utils/format';

const formatTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Detail bukti pembayaran Runsnet satu transaksi: status NYATA yang dibaca dari Runsnet, plus form unggah
// screenshot bukti (mis. layar Runsnet yang menunjukkan invoice PAID) yang tersimpan bersama transaksi.
const RunsnetProofModal = ({ transaction, runsnetStatus, session, onClose, onRecheck, onProofChanged }) => {
  const [proof, setProof] = useState(null); // { image, created_at, uploaded_by_name } | null
  const [loadingProof, setLoadingProof] = useState(true);
  const [draft, setDraft] = useState(null); // data URL screenshot yang baru dipilih
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  const code = runsnetCodeOf(transaction);
  const badge = describeRunsnetStatus(transaction, runsnetStatus);
  const mismatch = isRunsnetMismatch(transaction, runsnetStatus);
  const isSuper = session?.profile?.role === 'superadmin';
  const isWaTrx = transaction?.payment_method === 'Transfer WA' || Boolean(transaction?.cashier_name?.includes('WhatsApp'));
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };

  useEffect(() => {
    let cancelled = false;
    supabase.from('runsnet_proofs').select('image, created_at, uploaded_by_name').eq('transaction_id', transaction.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProof(data || null);
        setLoadingProof(false);
      });
    return () => { cancelled = true; };
  }, [transaction.id]);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    try {
      setDraft(await resizeImageFile(file, 1000, { type: 'image/jpeg', quality: 0.85 }));
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  const callApi = async (path, body) => {
    const response = await fetch(path, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  };

  const saveProof = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await callApi('/api/runsnet/save-proof', { transactionId: transaction.id, image: draft });
      setProof({ image: draft, created_at: new Date().toISOString(), uploaded_by_name: session?.profile?.full_name || null });
      
      // Sinkronkan juga ke watbiz_logs jika ada log terkait
      try {
        const { data: matchedLogs } = await supabase
          .from('watbiz_logs')
          .select('id, response_detail')
          .or('kind.eq.inbound_proof,kind.eq.auto_payment')
          .order('created_at', { ascending: false })
          .limit(10);
        if (matchedLogs && matchedLogs.length > 0) {
          for (const l of matchedLogs) {
            try {
              const d = typeof l.response_detail === 'string' ? JSON.parse(l.response_detail) : l.response_detail;
              if (d?.transactionId === transaction.id || (transaction.customerName && d?.customerName === transaction.customerName)) {
                d.mediaUrl = draft;
                d.needsPhotoAttachment = false;
                await supabase.from('watbiz_logs').update({ response_detail: JSON.stringify(d) }).eq('id', l.id);
                break;
              }
            } catch {}
          }
        }
      } catch {}

      setDraft(null);
      setMessage({ ok: true, text: 'Bukti transfer asli tersimpan permanen di database.' });
      onProofChanged(transaction.id, true);
    } catch (err) {
      setMessage({ ok: false, text: 'Gagal menyimpan bukti: ' + err.message });
    }
    setBusy(false);
  };

  const deleteProof = async () => {
    if (!window.confirm('Hapus bukti screenshot ini?')) return;
    setBusy(true);
    try {
      await callApi('/api/runsnet/save-proof', { transactionId: transaction.id, image: null });
      setProof(null);
      onProofChanged(transaction.id, false);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
    setBusy(false);
  };

  const resend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await callApi('/api/runsnet/sync-payment', { transactionId: transaction.id });
      setMessage({ ok: result.status === 'success', text: result.message || (result.skipped ? `Dilewati: ${result.skipped}` : 'Selesai.') });
      await onRecheck();
    } catch (err) {
      setMessage({ ok: false, text: 'Gagal mengirim: ' + err.message });
    }
    setBusy(false);
  };

  const shown = draft || proof?.image;

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center print:hidden animate-backdrop" onClick={onClose}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 animate-sheet-up sm:animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-black text-gray-900">
              {isWaTrx ? 'Foto Bukti Pembayaran WhatsApp' : 'Bukti Pembayaran Runsnet'}
            </h3>
            <p className="text-[11px] text-gray-500 truncate">{transaction.customerName} · {formatRupiah(transaction.price)}</p>
            <p className="text-[11px] font-mono text-gray-400 truncate">{code || transaction.id}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="shrink-0 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className={`rounded-2xl p-3.5 flex items-start gap-3 ${badge.tone === 'ok' ? 'bg-emerald-50 border border-emerald-200' : badge.tone === 'bad' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
          {badge.tone === 'ok' ? <CheckCircle2 size={22} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={22} className={badge.tone === 'bad' ? 'text-red-600 shrink-0' : 'text-amber-500 shrink-0'} />}
          <div className="text-xs space-y-0.5">
            <p className="font-black text-gray-900">{badge.text}</p>
            <p className="text-gray-500">Status ini dibaca langsung dari Runsnet. Catatan KAsir: <b>{transaction.status}</b>.</p>
            {mismatch && <p className="font-bold text-red-700">Tidak cocok: di KAsir sudah lunas, tapi di Runsnet belum PAID.</p>}
          </div>
        </div>

        {mismatch && transaction.status === 'LUNAS' && (
          <button type="button" onClick={resend} disabled={busy} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim pembayaran ke Runsnet
          </button>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {isWaTrx ? 'Foto Asli Bukti Struk Transfer' : 'Screenshot bukti'}
            </p>
            <button type="button" onClick={onRecheck} className="text-[11px] font-bold text-blue-600 flex items-center gap-1"><RefreshCw size={12} /> Cek ulang status</button>
          </div>

          {loadingProof ? (
            <p className="text-xs text-gray-400 italic text-center py-6">Memuat bukti...</p>
          ) : shown ? (
            <div className="space-y-1.5">
              <div className="rounded-xl overflow-hidden border border-emerald-300 bg-black/5 flex items-center justify-center max-h-[380px]">
                <img src={shown} alt="Bukti pembayaran" className="w-full h-auto object-contain max-h-[380px]" />
              </div>
              {!draft && proof && (
                <p className="text-[10px] text-gray-400">
                  Diunggah {formatTime(proof.created_at)}{proof.uploaded_by_name ? ` oleh ${proof.uploaded_by_name}` : ''}
                </p>
              )}
            </div>
          ) : isWaTrx ? (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-center">
              <p className="text-xs font-bold text-amber-900">Belum Ada Foto Struk Dilampirkan</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Transaksi ini tercatat otomatis via bot WhatsApp dari pelanggan <strong>{transaction.customerName}</strong>. Silakan klik tombol di bawah untuk melampirkan foto struk asli dari WhatsApp agar tersimpan permanen di database.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              Belum ada bukti. Ambil screenshot layar Runsnet yang menunjukkan invoice ini PAID, lalu unggah di sini.
            </p>
          )}

          {draft ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft(null)} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold disabled:opacity-60">Batal</button>
              <button type="button" onClick={saveProof} disabled={busy} className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-60">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Simpan foto bukti
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <label className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                isWaTrx && !proof
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
              }`}>
                <ImagePlus size={14} /> {proof ? (isWaTrx ? 'Ganti foto struk' : 'Ganti screenshot') : (isWaTrx ? '📎 Unggah Foto Struk dari WA' : 'Unggah screenshot')}
                <input type="file" accept="image/*" onChange={pickFile} className="sr-only" />
              </label>
              {proof && isSuper && (
                <button type="button" onClick={deleteProof} disabled={busy} aria-label="Hapus bukti" className="px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-60">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )}

          {badge.key !== 'PAID' && badge.key !== 'local' && (
            <p className="text-[10px] text-amber-700">Runsnet belum menunjukkan PAID — sebaiknya unggah bukti setelah statusnya PAID.</p>
          )}
        </div>

        {message && (
          <p className={`text-[11px] font-semibold rounded-xl px-3 py-2 ${message.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
};

export default RunsnetProofModal;
