import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import InstansiA4Preview from './InstansiA4Preview';
import { downloadInvoicePdf } from '../utils/instansiPdfExport';

// Pratinjau A4 layar penuh untuk HP: dokumen dirender di ukuran asli (210mm) lalu diskalakan supaya
// muat di layar (dihitung ulang tiap resize), dan dikembalikan ke ukuran asli saat dicetak/diunduh
// PDF supaya hasilnya identik dengan dokumen A4 sungguhan.
const InstansiPreviewModal = ({ invoiceData, lineItems, subtotal, profile, onClose }) => {
  const outerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ w: 794, h: 1123 });
  const [downloading, setDownloading] = useState(false);

  useLayoutEffect(() => {
    const contentEl = contentRef.current;
    const outerEl = outerRef.current;
    if (!contentEl || !outerEl) return;

    const update = () => {
      setNaturalSize({ w: contentEl.offsetWidth || 794, h: contentEl.offsetHeight || 1123 });
      const available = outerEl.clientWidth - 16;
      setScale(Math.min(available / (contentEl.offsetWidth || 794), 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(contentEl);
    ro.observe(outerEl);
    return () => ro.disconnect();
  }, [invoiceData, lineItems]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(contentRef.current, invoiceData.invoiceNumber, invoiceData.institutionName);
    } catch (err) {
      alert('Gagal membuat PDF: ' + err.message);
    }
    setDownloading(false);
  };

  // Portal ke body: halaman /instansi berada di dalam wrapper print:hidden milik App.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col print:bg-white print:block print:static instansi-print-root">
      <div className="flex items-center justify-between px-4 py-3 print:hidden">
        <span className="text-white font-bold text-sm truncate">{invoiceData.invoiceNumber}</span>
        <button type="button" onClick={onClose} aria-label="Tutup" className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white">
          <X size={20} />
        </button>
      </div>

      <div ref={outerRef} className="instansi-preview-outer flex-1 overflow-auto px-2 pb-28 print:p-0 print:overflow-visible print:block print:pb-0">
        <div style={{ width: naturalSize.w * scale, height: naturalSize.h * scale }} className="mx-auto instansi-preview-frame">
          <div
            ref={contentRef}
            className="instansi-preview-scale origin-top-left"
            style={{ transform: `scale(${scale})`, width: naturalSize.w, transformOrigin: 'top left' }}
          >
            <InstansiA4Preview invoiceData={invoiceData} lineItems={lineItems} subtotal={subtotal} profile={profile} />
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-[60] print:hidden w-full max-w-sm px-6">
        <button type="button" onClick={onClose} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold py-3.5 rounded-2xl shadow-2xl transition-all active:scale-95 border border-white/30">
          Tutup
        </button>
        <button type="button" onClick={handleDownload} disabled={downloading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
          {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} PDF
        </button>
        <button type="button" onClick={() => window.print()} className="flex-[1.3] bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl shadow-[0_15px_40px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2">
          <Printer size={18} /> Cetak
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default InstansiPreviewModal;
