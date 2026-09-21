import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeSyncStatus, syncToastTone } from '../utils/runsnetSync';

const POLL_MS = 1500;
const MAX_POLLS = 14; // ~21 detik menunggu, cukup untuk webhook Supabase memproses
const VISIBLE_MS = 6000;

const TONE_CLASSES = { ok: 'bg-emerald-600', bad: 'bg-red-600', info: 'bg-gray-700' };
const TONE_ICONS = { ok: CheckCircle2, bad: XCircle, info: Info };

// Notifikasi kecil otomatis-hilang yang muncul sesaat setelah transaksi disimpan, menunjukkan
// status sinkron pembayaran ke Runsnet (berhasil/gagal/mode uji coba). watchId = id transaksi yang
// baru disimpan. Diam saja (tidak menampilkan apa pun) kalau tidak ada baris log muncul dalam
// waktu wajar — misalnya karena webhook belum tersambung — supaya tidak membingungkan kasir.
const RunsnetSyncToast = ({ watchId }) => {
  const [entry, setEntry] = useState(null);
  const timersRef = useRef([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    // Tidak me-reset `entry` di sini: notifikasi transaksi sebelumnya (kalau masih tampil)
    // biar selesai sendiri lewat timernya sendiri; entry baru menimpanya begitu datanya datang.
    if (!watchId) return undefined;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from('runsnet_sync_log')
        .select('status, message')
        .eq('transaction_id', watchId)
        .eq('stage', 'payment')
        .maybeSingle();
      if (cancelled) return;

      if (data) {
        setEntry(data);
        timersRef.current.push(setTimeout(() => { if (!cancelled) setEntry(null); }, VISIBLE_MS));
        return;
      }

      attempts += 1;
      if (attempts < MAX_POLLS) {
        timersRef.current.push(setTimeout(poll, POLL_MS));
      }
    };

    poll();

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [watchId]);

  if (!entry) return null;

  const status = describeSyncStatus(entry.status);
  const tone = syncToastTone(entry.status);
  const Icon = TONE_ICONS[tone];

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] print:hidden">
      <div className={`${TONE_CLASSES[tone]} text-white text-xs font-bold pl-3 pr-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
        <Icon size={15} className="shrink-0" />
        <div className="min-w-0">
          <p>Runsnet: {status.text}</p>
          {entry.message && <p className="text-[10px] font-medium opacity-90 line-clamp-2">{entry.message}</p>}
        </div>
      </div>
    </div>
  );
};

export default RunsnetSyncToast;
