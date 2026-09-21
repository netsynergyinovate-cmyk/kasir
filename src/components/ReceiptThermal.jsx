import { useState, useEffect, useRef } from 'react';
import { Printer, Download, X, CheckCircle2, Loader2, Save } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getInvoiceNumber } from '../utils/format';
import { buildReceiptLines } from '../utils/receiptLines';
import { loadReceiptLogo } from '../utils/receiptLogo';

const TOAST_MS = 4000;

// isDraft: struk baru dari form Transaksi yang BELUM tersimpan. Transaksi baru tersimpan saat kasir
// menekan Simpan/Cetak (onCommit). Struk yang dibuka dari Riwayat sudah tersimpan (isDraft false).
// Pasang key={id transaksi} supaya state awal dihitung ulang tiap struk baru.
const ReceiptThermal = ({ transaction, companyInfo, onClose, onPrint, onCommit, btDevice, savedDeviceName, ensurePrinter, isDraft = false }) => {
  const [isPrinting, setIsConnecting] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [committed, setCommitted] = useState(!isDraft);
  const [toast, setToast] = useState(null);
  const [logoData, setLogoData] = useState(null);
  const receiptRef = useRef(null);
  const logoUrl = companyInfo?.logo;

  // Logo dijadikan hitam-putih murni, dipakai sama persis oleh pratinjau dan printer.
  useEffect(() => {
    let cancelled = false;
    loadReceiptLogo(logoUrl).then((data) => { if (!cancelled) setLogoData(data); });
    return () => { cancelled = true; };
  }, [logoUrl]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!transaction || transaction.type === 'instansi') return null;

  const receiptLines = buildReceiptLines(transaction, companyInfo);

  // Printer dianggap siap kalau sudah pernah dipasangkan (walau sambungannya sedang putus); sambungan dibuat
  // ulang otomatis saat mencetak.
  const printerReady = Boolean(btDevice) || Boolean(savedDeviceName);
  const busy = isPrinting || isSavingImage || isCommitting;

  // Menyimpan transaksi ke database kalau masih draf. true = sudah tersimpan (baru atau sebelumnya).
  const ensureSaved = async () => {
    if (committed) return true;
    setIsCommitting(true);
    try {
      const ok = await onCommit();
      if (ok) {
        setCommitted(true);
        setToast({ title: 'Transaksi berhasil tersimpan', sub: `Invoice ${getInvoiceNumber(transaction)}` });
      }
      return Boolean(ok);
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan transaksi: ' + error.message);
      return false;
    } finally {
      setIsCommitting(false);
    }
  };

  // Tombol utama: simpan, lalu langsung cetak kalau printer Bluetooth terhubung (kalau tidak, simpan saja).
  const handlePrimary = async () => {
    const wasDraft = !committed;
    // Ambil printer lebih dulu (bisa memunculkan dialog pilih perangkat, yang butuh sentuhan pengguna).
    let device = btDevice;
    if (!device && savedDeviceName && ensurePrinter) device = await ensurePrinter();
    if (!(await ensureSaved())) return;
    if (device) {
      const printed = await printViaBluetooth(device);
      if (printed && wasDraft) setToast({ title: 'Tersimpan & tercetak', sub: `Invoice ${getInvoiceNumber(transaction)}` });
    } else if (!wasDraft) {
      onClose();
    }
  };

  const handleSystemPrint = async () => {
    if (await ensureSaved()) onPrint();
  };

  const handleSaveImage = async () => {
    if (await ensureSaved()) await saveAsImage();
  };

  const handleClose = () => {
    if (!committed && !window.confirm('Struk ini belum disimpan. Batalkan transaksi?')) return;
    onClose();
  };

  const saveAsImage = async () => {
    if (!receiptRef.current) return;
    setIsSavingImage(true);
    try {
      const dataUrl = await toPng(receiptRef.current, { pixelRatio: 3, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `struk-${getInvoiceNumber(transaction)}.png`;
      link.href = dataUrl;
      link.click();
      setToast({ title: 'Struk berhasil disimpan', sub: 'Gambar struk tersimpan di perangkat ini' });
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan gambar struk: ' + error.message);
    } finally {
      setIsSavingImage(false);
    }
  };

  const printViaBluetooth = async (device = btDevice) => {
    if (!device) {
      onPrint();
      return false;
    }

    setIsConnecting(true);
    try {
      if (device.gatt && !device.gatt.connected) {
        await device.gatt.connect();
      }

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      const encoder = new TextEncoder();
      const printRaw = (data) => characteristic.writeValue(data);
      const printLine = (text) => characteristic.writeValue(encoder.encode(text + '\n'));
      const center = () => characteristic.writeValue(new Uint8Array([0x1b, 0x61, 0x01]));
      const left = () => characteristic.writeValue(new Uint8Array([0x1b, 0x61, 0x00]));
      const boldOn = () => characteristic.writeValue(new Uint8Array([0x1b, 0x45, 0x01]));
      const boldOff = () => characteristic.writeValue(new Uint8Array([0x1b, 0x45, 0x00]));
      const feed = () => characteristic.writeValue(new Uint8Array([0x1b, 0x64, 0x03]));
      
      // Helper to convert Image to ESC/POS Bit Image
      const printLogo = async (url) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const width = 160; // Max width for 58mm
            const height = Math.floor(img.height * (width / img.width));
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const imgData = ctx.getImageData(0, 0, width, height).data;
            
            // ESC/POS Image Command: GS v 0
            const xL = (width / 8) % 256;
            const xH = Math.floor((width / 8) / 256);
            const yL = height % 256;
            const yH = Math.floor(height / 256);
            
            const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
            const p = new Uint8Array(header.length + (width * height / 8));
            p.set(header);
            
            let pos = header.length;
            for (let y = 0; pos < p.length; y++) {
              for (let x = 0; x < width; x += 8) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                  const idx = ((y * width) + (x + bit)) * 4;
                  const r = imgData[idx];
                  const g = imgData[idx + 1];
                  const b = imgData[idx + 2];
                  const avg = (r + g + b) / 3;
                  if (avg < 128) byte |= (0x80 >> bit);
                }
                p[pos++] = byte;
              }
            }
            resolve(p);
          };
          img.src = url;
        });
      };

      // --- ESC/POS PRINTING ---
      await center();
      
      // Print Logo if exists
      if (logoData) {
        try {
          const logoBytes = await printLogo(logoData);
          // ESC/POS chips can only handle small chunks at a time
          const chunkSize = 512;
          for (let i = 0; i < logoBytes.length; i += chunkSize) {
            await printRaw(logoBytes.slice(i, i + chunkSize));
          }
          await printLine(''); // Space after logo
        } catch (err) {
          console.warn('Gagal cetak logo Bluetooth:', err);
        }
      }

      // Isi struk dari sumber yang sama dengan pratinjau (utils/receiptLines.js).
      let currentAlign = 'center';
      let currentBold = false;
      let currentSize = 'normal';
      for (const l of receiptLines) {
        if (l.align !== currentAlign) {
          await (l.align === 'center' ? center() : left());
          currentAlign = l.align;
        }
        if (l.bold !== currentBold) {
          await (l.bold ? boldOn() : boldOff());
          currentBold = l.bold;
        }
        if (l.size !== currentSize) {
          // GS ! n: 0x11 = lebar & tinggi 2x, 0x01 = tinggi 2x saja, 0x00 = normal.
          const sizeCode = l.size === 'large' ? 0x11 : l.size === 'tall' ? 0x01 : 0x00;
          await characteristic.writeValue(new Uint8Array([0x1d, 0x21, sizeCode]));
          currentSize = l.size;
        }
        await printLine(l.text);
      }
      if (currentBold) await boldOff();
      if (currentSize !== 'normal') await characteristic.writeValue(new Uint8Array([0x1d, 0x21, 0x00]));
      await feed();
      setToast({ title: 'Struk berhasil dicetak', sub: `Invoice ${getInvoiceNumber(transaction)}` });
      return true;
    } catch (error) {
      console.error(error);
      alert('Gagal mencetak via Bluetooth. Gunakan cetak browser.');
      onPrint(); // Fallback
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const printStyles = `
    @media print {
      @page {
        margin: 0;
        size: 58mm auto;
      }
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
      }
      .print-container {
        width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      img {
        display: block !important;
        visibility: visible !important;
        width: 160px !important;
        height: auto !important;
        margin-left: auto !important;
        margin-right: auto !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }
      * {
        color: black !important;
        background: transparent !important;
      }
    }
  `;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md print:bg-white print:p-0 flex flex-col no-print-overlay">
      <style>{printStyles}</style>

      <header className="shrink-0 flex items-center justify-between px-4 py-3 print:hidden no-print">
        <div>
          <p className="text-white text-sm font-black leading-tight">Struk Pembayaran</p>
          <p className="text-[11px] text-white/60 font-mono">{getInvoiceNumber(transaction)}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Tutup struk"
          className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/20 active:scale-95 transition-all"
        >
          <X size={20} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto print:overflow-visible">
      <div className="w-full flex justify-center py-3 px-4 print:p-0 print:m-0"> 
        <div ref={receiptRef} className="print-container bg-white w-full max-w-[300px] relative flex flex-col font-mono text-black print:m-0 print:w-[58mm] print:shadow-none shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden h-fit">
          
          <div className="h-3 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSI1Ij48cG9seWdvbiBwb2ludHM9IjAsNSA1LDAgMTAsNSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x absolute -top-[1px] left-0 z-10 print:hidden"></div>

          <div className="px-4 py-6 print:p-2">
            {logoData && (
              <img src={logoData} alt="Logo" width={160} className="block mx-auto mb-2" style={{ imageRendering: 'pixelated' }} />
            )}
            {/* Lebar tepat 32 karakter dan di tengah kertas, supaya garis pemisah dan teks tengah sejajar. */}
            <div className="mx-auto font-mono text-[13px] leading-[1.4] print:text-[10px]" style={{ width: '32ch' }}>
              {receiptLines.map((l, i) => (
                <div
                  key={i}
                  className={`whitespace-pre ${l.align === 'center' ? 'text-center' : 'text-left'} ${l.bold ? 'font-bold' : ''} ${l.size === 'large' ? 'text-[2em] leading-[1.15]' : ''}`}
                  style={l.size === 'tall' ? { height: '2.8em' } : undefined}
                >
                  {l.size === 'tall'
                    ? <div style={{ transform: 'scaleY(2)', transformOrigin: 'top' }}>{l.text || ' '}</div>
                    : (l.text || ' ')}
                </div>
              ))}
            </div>
          </div>

          <div className="h-3 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSI1Ij48cG9seWdvbiBwb2ludHM9IjAsMCA1LDUgMTAsMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x absolute -bottom-[1px] left-0 z-10 print:hidden"></div>
        </div>
      </div>

      </div>

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-[300px] print:hidden no-print animate-in fade-in slide-in-from-top-2 duration-300" role="status">
          <div className="bg-emerald-600 text-white rounded-2xl shadow-xl px-3.5 py-2.5 flex items-center gap-2.5">
            <CheckCircle2 size={22} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black leading-tight">{toast.title}</p>
              <p className="text-[10px] text-emerald-100 font-medium truncate">{toast.sub}</p>
            </div>
          </div>
        </div>
      )}

      <footer className="shrink-0 bg-gray-900/80 backdrop-blur-md border-t border-white/10 px-4 pt-3 pb-5 print:hidden no-print">
        <div className="mx-auto w-full max-w-[300px] flex flex-col gap-2.5">
          {!committed && (
            <p className="text-center text-[11px] font-bold text-amber-200 bg-amber-500/20 border border-amber-300/30 rounded-xl py-1.5 px-2">
              Belum tersimpan — cek struk, lalu {printerReady ? 'Cetak & Simpan' : 'Simpan'} atau Batal
            </p>
          )}
          <div className="flex gap-2.5">
            {!committed && (
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-300/30 font-bold py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-60"
              >
                Batal
              </button>
            )}
            <button
              onClick={handlePrimary}
              disabled={busy}
              className={`${committed ? 'w-full' : 'flex-[2]'} bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60`}
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : (printerReady ? <Printer size={20} /> : <Save size={20} />)}
              {isCommitting ? 'Menyimpan...' : isPrinting ? 'Mencetak...' : printerReady ? (committed ? 'Cetak Ulang' : 'Cetak & Simpan') : (committed ? 'Selesai' : 'Simpan')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleSaveImage}
              disabled={busy}
              className="bg-white/95 hover:bg-white text-gray-800 font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs disabled:opacity-60"
            >
              <Download size={15} />
              Simpan Gambar
            </button>
            <button
              onClick={handleSystemPrint}
              disabled={busy}
              className="bg-white/95 hover:bg-white text-gray-800 font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs disabled:opacity-60"
            >
              <Printer size={15} />
              Cetak Sistem
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ReceiptThermal;
