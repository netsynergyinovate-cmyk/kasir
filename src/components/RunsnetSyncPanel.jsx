import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Zap, Wifi, Loader2, CheckCircle2, XCircle, Search, Send, Undo2, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeSyncStatus } from '../utils/runsnetSync';
import { formatRupiah } from '../utils/format';
import ToggleSwitch from './ToggleSwitch';

const formatTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Relatif ("5 menit lalu") supaya cepat dibaca; jatuh balik ke jam untuk yang lebih lama dari sehari.
const formatRelative = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  return formatTime(iso);
};

// Label + ikon tahap, dipakai menyusun tiap baris di garis waktu (bukan lagi tetap 1 baris per tahap — kasir
// bisa coba beberapa kali, jadi satu invoice bisa punya lebih dari satu baris "Kirim Pembayaran").
const STAGE_META = {
  invoice_lookup: { label: 'Cek Nomor Invoice', icon: Search },
  payment: { label: 'Kirim Pembayaran', icon: Send },
  reversal: { label: 'Reversal (Batal)', icon: Undo2 },
};

// Warna & ikon bulatan tahap berdasarkan status barisnya.
const STEP_LOOK = {
  success: { dot: 'bg-emerald-500 text-white', icon: CheckCircle2 },
  failed: { dot: 'bg-red-500 text-white', icon: XCircle },
  dry_run: { dot: 'bg-amber-400 text-white', icon: Minus },
  skipped_disabled: { dot: 'bg-gray-300 text-white', icon: Minus },
  skipped_not_configured: { dot: 'bg-gray-300 text-white', icon: Minus },
};

// Panel superadmin: saklar sinkronisasi otomatis KAsir -> Runsnet + mode uji coba, dan log percobaan
// terakhir. Toggle menulis langsung ke company_settings; keputusan sinkron sesungguhnya dijalankan
// oleh Vercel Function (api/runsnet/webhook.js) yang membaca kolom ini.
const RunsnetSyncPanel = ({ session }) => {
  const [enabled, setEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [txById, setTxById] = useState({});
  const [filter, setFilter] = useState('all');

  const fetchAll = () => Promise.all([
    supabase.from('company_settings').select('runsnet_sync_enabled, runsnet_dry_run').eq('id', 1).maybeSingle(),
    supabase.from('runsnet_sync_log').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const applyResults = ([settingsRes, logsRes]) => {
    if (settingsRes.data) {
      setEnabled(Boolean(settingsRes.data.runsnet_sync_enabled));
      setDryRun(settingsRes.data.runsnet_dry_run ?? true);
    }
    if (logsRes.data) {
      setLogs(logsRes.data);
      loadTransactionNames(logsRes.data);
    }
    setIsLoading(false);
  };

  // Nama pelanggan + nominal tiap baris log, diambil dari tabel transaksi (log sendiri hanya menyimpan id).
  const loadTransactionNames = async (rows) => {
    const ids = [...new Set(rows.map((r) => r.transaction_id))];
    if (ids.length === 0) return;
    const { data } = await supabase.from('transactions').select('id, customer_name, instansi_name, price').in('id', ids);
    if (data) setTxById(Object.fromEntries(data.map((t) => [t.id, t])));
  };

  const load = async () => applyResults(await fetchAll());

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((results) => {
      if (!cancelled) applyResults(results);
    });
    return () => { cancelled = true; };
    // Hanya dijalankan sekali saat panel dibuka; muat ulang manual lewat tombol refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToggle = async (patch) => {
    setSaving(true);
    const { error } = await supabase.from('company_settings').update(patch).eq('id', 1);
    if (!error) {
      if ('runsnet_sync_enabled' in patch) setEnabled(patch.runsnet_sync_enabled);
      if ('runsnet_dry_run' in patch) setDryRun(patch.runsnet_dry_run);
    } else {
      alert('Gagal menyimpan pengaturan: ' + error.message);
    }
    setSaving(false);
  };

  // Mengirim ulang pembayaran satu transaksi (untuk yang gagal / dilewati / hanya uji coba). Aman: server hanya
  // membayar invoice yang benar-benar masih PENDING, lalu membuktikan statusnya PAID.
  const retryRow = async (row) => {
    const modeNote = !enabled
      ? 'Catatan: sinkron sedang MATI, jadi belum benar-benar terkirim.'
      : dryRun ? 'Catatan: sinkron sedang MODE UJI COBA, jadi belum benar-benar terkirim.' : '';
    if (!window.confirm(`Kirim ulang pembayaran ${row.search_query || row.transaction_id} ke Runsnet?\n\n${modeNote}`.trim())) return;
    setRetryingId(row.id);
    try {
      const response = await fetch('/api/runsnet/sync-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ transactionId: row.transaction_id }),
      });
      const result = await response.json();
      if (!response.ok) alert('Gagal: ' + (result.error || `HTTP ${response.status}`));
    } catch (err) {
      alert('Gagal menghubungi server: ' + err.message);
    }
    setRetryingId(null);
    await load();
  };

  // Membatalkan pembayaran di Runsnet untuk transaksi yang SUDAH terhapus dari KAsir (tanpa reversal). Hanya
  // muncul di baris log pembayaran yang terbukti PAID tapi transaksinya sudah tidak ada. Server tetap menjaga:
  // sinkron LIVE, invoice PAID, dan tepat satu pembayaran; hasilnya dibuktikan dengan membaca status Runsnet.
  const reverseOrphan = async (row) => {
    const code = row.runsnet_ref || row.search_query;
    if (!window.confirm(`Batalkan (reversal) pembayaran invoice ${code} di Runsnet?\n\nTransaksinya sudah dihapus dari KAsir. Pembayaran di Runsnet akan DIBATALKAN dan invoice kembali PENDING.`)) return;
    setRetryingId(row.id);
    try {
      const response = await fetch('/api/runsnet/reverse-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ transactionId: row.transaction_id }),
      });
      const result = await response.json();
      alert(!response.ok ? 'Gagal: ' + (result.error || `HTTP ${response.status}`) : (result.message || 'Selesai.'));
    } catch (err) {
      alert('Gagal menghubungi server: ' + err.message);
    }
    setRetryingId(null);
    await load();
  };

  const testConnection = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const response = await fetch('/api/runsnet/ping', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        setPingResult({ ok: false, message: result.error || `HTTP ${response.status}` });
      } else {
        setPingResult(result);
      }
    } catch (err) {
      setPingResult({ ok: false, message: 'Endpoint /api/runsnet/ping tidak terjangkau: ' + err.message });
    }
    setPinging(false);
  };

  // Satu kartu per INVOICE RUNSNET (bukan per baris log ATAU per id transaksi lokal): tiap kali kasir mencoba
  // ulang, KAsir membuat id transaksi lokal yang baru, jadi mengelompokkan per id transaksi memecah "cek nomor
  // invoice" dan "kirim pembayaran" untuk invoice yang sama jadi kartu terpisah. Dikelompokkan pakai kode invoice
  // Runsnet-nya (runsnet_ref, atau search_query kalau belum ketemu) supaya seluruh percobaan untuk satu invoice
  // yang sama tetap satu kartu, diurutkan sebagai garis waktu (bisa lebih dari satu baris per tahap kalau diulang).
  const groups = useMemo(() => {
    const map = new Map();
    logs.forEach((row) => {
      const key = row.runsnet_ref || row.search_query || row.transaction_id;
      if (!map.has(key)) map.set(key, { key, rows: [], latest: row.created_at });
      const g = map.get(key);
      g.rows.push(row);
      if (row.created_at > g.latest) g.latest = row.created_at;
    });
    return [...map.values()]
      .map((g) => ({ ...g, rows: g.rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) }))
      .sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [logs]);

  const reversedIds = new Set(logs.filter((r) => r.stage === 'reversal' && r.status === 'success').map((r) => r.transaction_id));
  const lastPaymentOf = (g) => [...g.rows].reverse().find((r) => (r.stage || 'payment') === 'payment');
  const hasReversalOf = (g) => g.rows.some((r) => r.stage === 'reversal');

  const FILTERS = [
    { key: 'all', label: 'Semua', match: () => true },
    { key: 'failed', label: 'Bermasalah', match: (g) => g.rows.some((r) => r.status === 'failed') },
    { key: 'paid', label: 'Sudah PAID', match: (g) => lastPaymentOf(g)?.status === 'success' },
    { key: 'reversal', label: 'Reversal', match: (g) => hasReversalOf(g) },
  ];
  const visibleGroups = groups.filter((FILTERS.find((f) => f.key === filter) || FILTERS[0]).match);

  return (
    <div>
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-1.5">
        <Zap size={14} className="text-blue-600" /> Sinkronisasi Runsnet
      </h2>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <p className="text-[11px] text-gray-500">
          Saat pembayaran tercatat lunas di Kasir, tandai otomatis lunas juga di billing Runsnet.
        </p>

        <div className={`rounded-xl px-3 py-2.5 text-[11px] font-bold leading-snug ${!enabled ? 'bg-gray-100 text-gray-600' : dryRun ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
          {!enabled && 'SINKRON MATI — tidak ada pembayaran yang dikirim ke Runsnet.'}
          {enabled && dryRun && 'MODE UJI COBA — pembayaran hanya dicatat di log dan TIDAK masuk ke Runsnet. Matikan mode uji coba untuk kirim sungguhan.'}
          {enabled && !dryRun && 'LIVE — pembayaran dikirim sungguhan ke Runsnet. Berhasil hanya dicatat setelah Runsnet menunjukkan status PAID.'}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">Aktifkan sinkronisasi otomatis</p>
            <p className="text-[11px] text-gray-400">Kalau mati, tidak ada apa pun yang dikirim ke Runsnet.</p>
          </div>
          <ToggleSwitch
            label="Aktifkan sinkronisasi otomatis"
            checked={enabled}
            disabled={saving}
            onChange={(checked) => saveToggle({ runsnet_sync_enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">Mode uji coba</p>
            <p className="text-[11px] text-gray-400">Dicatat di log tapi TIDAK benar-benar dikirim ke Runsnet. Matikan setelah yakin hasilnya benar.</p>
          </div>
          <ToggleSwitch
            label="Mode uji coba"
            color="amber"
            checked={dryRun}
            disabled={saving}
            onChange={(checked) => saveToggle({ runsnet_dry_run: checked })}
          />
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-2">
          <button
            type="button"
            onClick={testConnection}
            disabled={pinging}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all disabled:opacity-60"
          >
            {pinging ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            {pinging ? 'Menguji koneksi...' : 'Uji Koneksi ke Runsnet'}
          </button>

          {pingResult && (
            <p className={`text-[11px] font-semibold rounded-xl px-3 py-2 flex items-start gap-1.5 ${pingResult.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
              {pingResult.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
              {pingResult.ok ? 'Berhasil login ke Runsnet. Kredensial dan koneksi sudah benar.' : `Gagal: ${pingResult.message}`}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Riwayat Pengiriman ke Runsnet</p>
            <button type="button" onClick={load} aria-label="Muat ulang log" className="text-gray-400 hover:text-gray-600"><RefreshCw size={13} /></button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTERS.map((f) => {
              const count = groups.filter(f.match).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {f.label} <span className={filter === f.key ? 'opacity-80' : 'text-gray-400'}>{count}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <p className="text-xs text-gray-400 italic text-center py-3">Memuat log...</p>
          ) : visibleGroups.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-3">{groups.length === 0 ? 'Belum ada percobaan sinkron.' : 'Tidak ada catatan untuk filter ini.'}</p>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((g) => {
                // Nama & nominal diambil dari id transaksi PALING BARU dalam kelompok ini (percobaan terkini).
                const lastRow = g.rows[g.rows.length - 1];
                const tx = txById[lastRow.transaction_id];
                // Nama Runsnet sendiri (tersimpan di baris log-nya) diutamakan — tetap ada walau transaksinya
                // sudah dihapus dari KAsir. Baru turun ke nama transaksi KAsir, lalu kata kunci pencarian.
                const runsnetName = [...g.rows].reverse().find((r) => r.customer_name)?.customer_name;
                const firstQuery = g.rows.find((r) => r.search_query)?.search_query;
                const name = runsnetName || tx?.customer_name || tx?.instansi_name || firstQuery || g.key;
                const lastPayment = lastPaymentOf(g);
                const paymentDone = lastPayment?.status === 'success';
                const needsReversalHint = paymentDone && !hasReversalOf(g);
                const overallBad = g.rows.some((r) => r.status === 'failed');
                const isOrphan = !tx && paymentDone && !reversedIds.has(lastRow.transaction_id);

                return (
                  <div key={g.key} className={`p-3.5 rounded-xl border bg-white shadow-sm space-y-3 ${overallBad ? 'border-red-200' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 leading-tight truncate">{name}</p>
                        <p className="text-[10px] font-mono text-gray-400 truncate">{g.key}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {tx?.price != null && <p className="text-xs font-black text-blue-700">{formatRupiah(tx.price)}</p>}
                        <p className="text-[10px] text-gray-400">{formatRelative(g.latest)}</p>
                      </div>
                    </div>

                    {isOrphan && (
                      <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                        Transaksi ini sudah tidak ada di Riwayat KAsir, tapi pembayarannya masih tercatat PAID di Runsnet.
                      </p>
                    )}
                    {g.rows.length > 1 && (
                      <p className="text-[10px] text-gray-400">{g.rows.length}x percobaan untuk invoice yang sama.</p>
                    )}

                    <div className="space-y-0">
                      {g.rows.map((row, idx) => {
                        const stageKey = row.stage || 'payment';
                        const meta = STAGE_META[stageKey];
                        const look = STEP_LOOK[row.status] || { dot: 'bg-blue-500 text-white', icon: meta.icon };
                        const StepIcon = look.icon;
                        const status = describeSyncStatus(row.status);
                        const isLastRow = idx === g.rows.length - 1 && !needsReversalHint;
                        const isCurrentPayment = stageKey === 'payment' && row.id === lastPayment?.id;
                        const noteTone = row.status === 'failed' ? 'bg-red-50 text-red-800 border-red-100' : row.status === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-gray-50 text-gray-600 border-gray-100';
                        const noteLabel = row.status === 'failed' ? 'Penyebab' : row.status === 'success' ? 'Bukti' : 'Keterangan';
                        return (
                          <div key={row.id} className="flex gap-2.5">
                            <div className="flex flex-col items-center shrink-0">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${look.dot}`}><StepIcon size={13} /></span>
                              {!isLastRow && <span className="w-[2px] flex-1 bg-gray-200 my-0.5" style={{ minHeight: 14 }} />}
                            </div>
                            <div className="flex-1 min-w-0 pb-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-black text-gray-800">{meta.label}</span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${status.className}`}>{status.text}</span>
                                <span className="text-[9px] text-gray-400">{formatTime(row.created_at)}</span>
                              </div>
                              {row.message && (
                                <p className={`mt-1 text-[11px] leading-snug rounded-lg border px-2 py-1.5 ${noteTone}`}>
                                  <b>{noteLabel}:</b> {row.message}
                                </p>
                              )}
                              {isCurrentPayment && row.status === 'success' && isOrphan && (
                                <button
                                  type="button"
                                  onClick={() => reverseOrphan(row)}
                                  disabled={retryingId === row.id}
                                  className="mt-1.5 w-full py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  {retryingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                  {retryingId === row.id ? 'Membatalkan...' : 'Batalkan pembayaran di Runsnet'}
                                </button>
                              )}
                              {isCurrentPayment && row.status !== 'success' && (
                                <button
                                  type="button"
                                  onClick={() => retryRow(row)}
                                  disabled={retryingId === row.id}
                                  className="mt-1.5 w-full py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  {retryingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                  {retryingId === row.id ? 'Mengirim...' : 'Kirim ulang ke Runsnet'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {needsReversalHint && (
                        <div className="flex gap-2.5">
                          <div className="flex flex-col items-center shrink-0">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 text-gray-400"><Undo2 size={12} /></span>
                          </div>
                          <p className="flex-1 text-[11px] text-gray-400 italic pt-1">Reversal belum pernah dijalankan untuk invoice ini.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunsnetSyncPanel;
