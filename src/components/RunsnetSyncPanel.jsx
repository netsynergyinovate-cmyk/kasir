import { useState, useEffect } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeSyncStatus } from '../utils/runsnetSync';

const formatTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Panel superadmin: saklar sinkronisasi otomatis KAsir -> Runsnet + mode uji coba, dan log percobaan
// terakhir. Toggle menulis langsung ke company_settings; keputusan sinkron sesungguhnya dijalankan
// oleh Vercel Function (api/runsnet/webhook.js) yang membaca kolom ini.
const RunsnetSyncPanel = () => {
  const [enabled, setEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = () => Promise.all([
    supabase.from('company_settings').select('runsnet_sync_enabled, runsnet_dry_run').eq('id', 1).maybeSingle(),
    supabase.from('runsnet_sync_log').select('*').order('created_at', { ascending: false }).limit(10),
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

  return (
    <div>
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-1.5">
        <Zap size={14} className="text-blue-600" /> Sinkronisasi Runsnet
      </h2>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <p className="text-[11px] text-gray-500">
          Saat pembayaran tercatat lunas di Kasir, tandai otomatis lunas juga di billing Runsnet.
        </p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">Aktifkan sinkronisasi otomatis</p>
            <p className="text-[11px] text-gray-400">Kalau mati, tidak ada apa pun yang dikirim ke Runsnet.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => saveToggle({ runsnet_sync_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">Mode uji coba</p>
            <p className="text-[11px] text-gray-400">Dicatat di log tapi TIDAK benar-benar dikirim ke Runsnet. Matikan setelah yakin hasilnya benar.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              disabled={saving}
              onChange={(e) => saveToggle({ runsnet_dry_run: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
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
                return (
                  <div key={row.id} className="p-2.5 bg-slate-50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-gray-700 truncate">{row.search_query || row.transaction_id}</span>
                      <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${status.className}`}>{status.text}</span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {formatTime(row.created_at)}
                      {row.runsnet_ref && ` · invoice Runsnet: ${row.runsnet_ref}`}
                    </p>
                    {row.message && <p className="text-[10px] text-gray-500">{row.message}</p>}
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
