import { useState, useEffect } from 'react';
import { RefreshCw, Zap, Wifi, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeSyncStatus, describeLogStage } from '../utils/runsnetSync';
import ToggleSwitch from './ToggleSwitch';

const formatTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

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

  const fetchAll = () => Promise.all([
    supabase.from('company_settings').select('runsnet_sync_enabled, runsnet_dry_run').eq('id', 1).maybeSingle(),
    supabase.from('runsnet_sync_log').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const applyResults = ([settingsRes, logsRes]) => {
    if (settingsRes.data) {
      setEnabled(Boolean(settingsRes.data.runsnet_sync_enabled));
      setDryRun(settingsRes.data.runsnet_dry_run ?? true);
    }
    if (logsRes.data) setLogs(logsRes.data);
    setIsLoading(false);
  };

  const load = async () => applyResults(await fetchAll());

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((results) => {
      if (!cancelled) applyResults(results);
    });
    return () => { cancelled = true; };
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

        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Percobaan Terakhir</p>
            <button type="button" onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={13} /></button>
          </div>

          {isLoading ? (
            <p className="text-xs text-gray-400 italic text-center py-3">Memuat log...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-3">Belum ada percobaan sinkron.</p>
          ) : (
            <div className="space-y-1.5">
              {logs.map((row) => {
                const status = describeSyncStatus(row.status);
                const stage = describeLogStage(row.stage || 'payment');
                return (
                  <div key={row.id} className="p-2.5 bg-slate-50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-gray-700 truncate">{row.search_query || row.transaction_id}</span>
                      <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${status.className}`}>{status.text}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${stage.className}`}>{stage.text}</span>
                      <span className="text-[10px] text-gray-400">{formatTime(row.created_at)}</span>
                    </div>
                    {row.runsnet_ref && <p className="text-[10px] text-gray-400">invoice Runsnet: <span className="font-mono font-bold text-gray-600">{row.runsnet_ref}</span></p>}
                    {row.message && <p className="text-[10px] text-gray-500">{row.message}</p>}
                    {(row.stage || 'payment') === 'payment' && row.status !== 'success' && (
                      <button
                        type="button"
                        onClick={() => retryRow(row)}
                        disabled={retryingId === row.id}
                        className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                      >
                        {retryingId === row.id ? 'Mengirim...' : 'Kirim ulang'}
                      </button>
                    )}
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
