import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { describeSyncStatus, syncToastTone } from '../utils/runsnetSync';

const VISIBLE_MS = 8000;

const TONE_CLASSES = { ok: 'bg-emerald-600', bad: 'bg-red-600', info: 'bg-gray-700' };
const TONE_ICONS = { ok: CheckCircle2, bad: XCircle, info: Info };

// Notifikasi kecil otomatis-hilang yang muncul setelah transaksi disimpan, menampilkan hasil pengiriman ke
// Runsnet: result = { status, message } dari jawaban server (api/runsnet/sync-payment). Sengaja tidak membaca
// tabel log (hanya superadmin yang boleh membacanya) supaya admin kasir melihat hasil yang sama.
const RunsnetSyncToast = ({ result, onDone }) => {
  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => onDone?.(), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [result, onDone]);

  if (!result) return null;

  const status = describeSyncStatus(result.status);
  const tone = syncToastTone(result.status);
  const Icon = TONE_ICONS[tone];

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[92vw] max-w-sm print:hidden" role="status">
      <div className={`${TONE_CLASSES[tone]} text-white text-xs font-bold pl-3 pr-4 py-2.5 rounded-xl shadow-lg flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
        <Icon size={16} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p>Runsnet: {status.text}</p>
          {result.message && <p className="text-[10px] font-medium opacity-90 line-clamp-3">{result.message}</p>}
        </div>
      </div>
    </div>
  );
};

export default RunsnetSyncToast;
