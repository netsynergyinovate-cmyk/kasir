import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { UPDATE_READY_EVENT, applyPendingUpdate } from '../utils/appUpdate';

// Muncul kalau versi baru aplikasi sudah terunduh. Tidak memuat ulang sendiri supaya struk yang belum
// disimpan tidak hilang — kasir menekan Perbarui saat sudah selesai.
const UpdateBanner = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener(UPDATE_READY_EVENT, onReady);
    return () => window.removeEventListener(UPDATE_READY_EVENT, onReady);
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[90] w-[92vw] max-w-sm print:hidden" role="status">
      <div className="bg-indigo-600 text-white rounded-2xl shadow-xl pl-4 pr-2 py-2 flex items-center gap-3">
        <p className="flex-1 text-xs font-bold leading-tight">Versi baru KAsir tersedia. Perbarui supaya fitur & perbaikan terbaru dipakai.</p>
        <button
          type="button"
          onClick={applyPendingUpdate}
          className="shrink-0 flex items-center gap-1.5 bg-white text-indigo-700 text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-all"
        >
          <RefreshCw size={13} /> Perbarui
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
