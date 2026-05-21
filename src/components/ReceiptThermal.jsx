import { useState } from 'react';
import { Printer } from 'lucide-react';
import { formatRupiah, formatDate } from '../utils/format';

const ReceiptThermal = ({ transaction, companyInfo, onClose, onPrint, btDevice }) => {
  const [isPrinting, setIsConnecting] = useState(false);

  if (!transaction || transaction.type === 'instansi') return null;

  const printViaBluetooth = async () => {
    if (!btDevice) {
      onPrint();
      return;
    }

    setIsConnecting(true);
    try {
      if (btDevice.gatt && !btDevice.gatt.connected) {
        await btDevice.gatt.connect();
      }

      const server = await btDevice.gatt.connect();
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
      
      const formatRow = (label, value) => {
        const totalChars = 32;
        const spaces = totalChars - label.length - value.length;
        return label + ' '.repeat(Math.max(1, spaces)) + value;
      };

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
      if (companyInfo.logo) {
        try {
          const logoData = await printLogo(companyInfo.logo);
          // ESC/POS chips can only handle small chunks at a time
          const chunkSize = 512;
          for (let i = 0; i < logoData.length; i += chunkSize) {
            await printRaw(logoData.slice(i, i + chunkSize));
          }
          await printLine(''); // Space after logo
        } catch (err) {
          console.warn('Gagal cetak logo Bluetooth:', err);
        }
      }

      await boldOn();
      await printLine(companyInfo.name.toUpperCase());
      await boldOff();
      await printLine(companyInfo.address);
      await printLine('WA: ' + companyInfo.phone);
      await printLine('================================');

      await left();
      await printLine(formatRow('Waktu:', formatDate(transaction.date)));
      await printLine(formatRow('Kasir:', transaction.cashierName || 'Admin'));
      await printLine(formatRow('INV:', transaction.id));
      await printLine('--------------------------------');

      await center();
      await printLine('--------------------------------');
      await boldOn();
      await printLine(transaction.status.toUpperCase());
      await boldOff();
      await printLine('--------------------------------');
      
      await left();
      await printLine('PELANGGAN:');
      await boldOn();
      await printLine(transaction.customerName.toUpperCase());
      await boldOff();
      await printLine('LAYANAN: ' + transaction.packageName);
      await printLine('--------------------------------');

      await boldOn();
      await printLine(formatRow('TOTAL', formatRupiah(transaction.price)));
      await boldOff();
      await printLine(formatRow('METODE:', transaction.paymentMethod));
      await printLine(formatRow('BAYAR:', formatRupiah(transaction.amountPaid || transaction.price)));
      await printLine(formatRow('KEMBALI:', formatRupiah(Math.max(0, (transaction.amountPaid || transaction.price) - transaction.price))));
      await printLine('--------------------------------');

      await center();
      await boldOn();
      await printLine('TERIMA KASIH');
      await boldOff();
      await printLine('Layanan internet handal & cepat');
      await printLine('Simpan struk ini sebagai bukti');
      await feed();

    } catch (error) {
      console.error(error);
      alert('Gagal mencetak via Bluetooth. Gunakan cetak browser.');
      onPrint(); // Fallback
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
        width: 120px !important;
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md overflow-y-auto print:bg-white print:p-0 flex flex-col items-center no-print-overlay">
      <style>{printStyles}</style>
      <div className="w-full flex justify-center py-10 px-4 mb-32 print:p-0 print:m-0"> 
        <div className="print-container bg-white w-full max-w-[300px] relative flex flex-col font-mono text-black print:m-0 print:w-[58mm] print:shadow-none shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden h-fit">
          
          <div className="h-3 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSI1Ij48cG9seWdvbiBwb2ludHM9IjAsNSA1LDAgMTAsNSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x absolute -top-[1px] left-0 z-10 print:hidden"></div>

          <div className="p-6 print:p-2">
            <div className="text-center mb-6 border-b border-dashed border-black pb-4">
              {companyInfo.logo && (
                <img src={companyInfo.logo} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-3 grayscale brightness-50" />
              )}
              <h1 className="font-bold text-lg uppercase tracking-tight leading-none mb-1">{companyInfo.name}</h1>
              <p className="text-[10px] leading-tight opacity-80">{companyInfo.address}</p>
              <p className="text-[10px] mt-1 font-bold">WA: {companyInfo.phone}</p>
            </div>
            
            <div className="text-[11px] mb-4">
              <div className="flex justify-between mb-1">
                <span>Waktu:</span>
                <span className="text-right">{formatDate(transaction.date)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Kasir:</span>
                <span>{transaction.cashierName || 'Admin Utama'}</span>
              </div>
              <div className="flex justify-between border-t border-dotted border-black mt-1 pt-1">
                <span>NO. INVOICE:</span>
                <span className="font-bold">{transaction.id}</span>
              </div>
            </div>

            <div className="text-center py-2 mb-4 border-y-2 border-black bg-black/5">
              <h2 className="text-lg font-black tracking-widest uppercase">{transaction.status}</h2>
            </div>

            <div className="space-y-1 mb-4">
               <p className="font-bold text-xs uppercase border-b border-black inline-block mb-1">DATA PELANGGAN:</p>
               <p className="font-bold text-sm uppercase leading-tight">{transaction.customerName}</p>
               <div className="flex justify-between text-[11px] mt-1 italic">
                 <span>LAYANAN: {transaction.packageName}</span>
               </div>
            </div>

            <div className="border-t border-dashed border-black pt-3 mt-3">
               <div className="flex justify-between font-black text-lg mb-1">
                 <span>TOTAL</span>
                 <span>{formatRupiah(transaction.price)}</span>
               </div>
               <p className="text-[8px] text-center w-full mb-3 opacity-60">*Sudah termasuk PPN 11%</p>
               
               <div className="space-y-0.5 text-[10px] opacity-80">
                 <div className="flex justify-between">
                   <span>METODE BAYAR:</span>
                   <span className="font-bold">{transaction.paymentMethod}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>BAYAR:</span>
                   <span className="font-bold">{formatRupiah(transaction.amountPaid || transaction.price)}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>KEMBALI:</span>
                   <span className="font-bold">{formatRupiah(Math.max(0, (transaction.amountPaid || transaction.price) - transaction.price))}</span>
                 </div>
               </div>
            </div>

            <div className="text-center text-[9px] mt-8 border-t border-dotted border-black pt-4">
              <p className="mb-1 font-bold">TERIMA KASIH</p>
              <p>Simpan struk ini sebagai bukti pembayaran yang sah.</p>
              
              <div className="mt-6 flex flex-col items-center">
                <div className="flex items-end h-8 gap-[1px]">
                  {[2,1,3,1,4,2,1,3,2,1,4,1,2,3].map((w, i) => (
                    <div key={i} className="bg-black h-full" style={{ width: `${w}px` }}></div>
                  ))}
                </div>
                <p className="mt-1 tracking-[0.3em] font-bold text-[8px]">{transaction.id}</p>
              </div>
            </div>
          </div>

          <div className="h-3 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSI1Ij48cG9seWdvbiBwb2ludHM9IjAsMCA1LDUgMTAsMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x absolute -bottom-[1px] left-0 z-10 print:hidden"></div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-3 z-[60] print:hidden w-full max-w-[300px] px-4 no-print">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 border border-white/20">
              Tutup
            </button>
            <button 
              onClick={printViaBluetooth} 
              disabled={isPrinting}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Printer size={20} /> 
              {isPrinting ? 'Mencetak...' : 'Cetak Bluetooth'}
            </button>
          </div>
          <button 
            onClick={onPrint}
            className="w-full bg-white/90 hover:bg-white text-blue-900 font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-xs"
          >
            <Printer size={16} /> 
            Gunakan Cetak Sistem (Jika Bluetooth Lambat)
          </button>
      </div>
    </div>
  );
};

export default ReceiptThermal;
