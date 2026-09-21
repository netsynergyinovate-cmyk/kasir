import React from 'react';
import { X, Printer } from 'lucide-react';
import { formatRupiah, formatDate, getInvoiceNumber } from '../utils/format';

const ReceiptA4 = ({ transaction, companyInfo, onClose, onPrint }) => {
  if (!transaction || transaction.type !== 'instansi') return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="print-a4-container bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto m-auto shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-12 sm:p-16 relative flex flex-col print:shadow-none print:m-0 print:p-12">
        
        <div className="flex justify-between items-start border-b-4 border-gray-900 pb-8 mb-10">
          <div className="flex items-center gap-6">
             {companyInfo?.logo ? (
                 <img src={companyInfo.logo} alt="Logo" className="w-24 h-24 object-contain" />
              ) : (
                <div className="w-24 h-24 bg-blue-600 flex items-center justify-center text-white font-black text-2xl rounded-2xl shadow-inner">ISP</div>
              )}
              <div>
                <h1 className="text-3xl font-black uppercase text-gray-900 tracking-tight leading-tight">{companyInfo.name}</h1>
                <p className="text-sm text-gray-600 mt-2 font-medium max-w-xs">{companyInfo.address}</p>
                <div className="flex gap-4 mt-3 text-sm font-bold text-gray-800">
                  <span className="flex items-center gap-1">WA: {companyInfo.phone}</span>
                </div>
              </div>
          </div>
          <div className="text-right">
            <h2 className="text-5xl font-black text-blue-600 tracking-tighter uppercase mb-3">INVOICE</h2>
            <div className="space-y-1">
              <p className="font-bold text-gray-500 text-xs tracking-widest uppercase">Nomor Invoice</p>
              <p className="font-mono text-lg font-bold text-gray-900">{getInvoiceNumber(transaction)}</p>
              <p className="font-bold text-gray-500 text-xs tracking-widest uppercase mt-4">Tanggal Terbit</p>
              <p className="font-bold text-gray-900">{formatDate(transaction.date)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 mb-12">
          <div className="p-6 bg-gray-50 border-l-4 border-blue-600 rounded-r-2xl">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Ditagihkan Kepada:</p>
            <h3 className="text-2xl font-black text-gray-900 leading-tight">{transaction.instansiName}</h3>
            <p className="text-gray-600 mt-2 font-medium">{transaction.address}</p>
          </div>
          <div className="p-6 bg-gray-50 border-l-4 border-gray-300 rounded-r-2xl flex flex-col justify-center">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Status Pembayaran:</p>
            <span className="inline-flex items-center px-4 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-black uppercase tracking-wider w-fit">PENDING / DUE</span>
          </div>
        </div>

        <div className="flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-y-2 border-gray-900 bg-gray-50">
                <th className="py-4 px-6 font-black uppercase text-xs tracking-widest text-center w-20">Item</th>
                <th className="py-4 px-6 font-black uppercase text-xs tracking-widest">Deskripsi Layanan</th>
                <th className="py-4 px-6 font-black uppercase text-xs tracking-widest text-right w-64">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-6 px-6 text-center font-bold text-gray-400">01</td>
                <td className="py-6 px-6">
                  <p className="font-black text-gray-900 text-lg uppercase">{transaction.serviceName}</p>
                  <p className="text-sm text-gray-500 mt-1 italic font-medium">Layanan internet dedicated / broadband sesuai kontrak.</p>
                </td>
                <td className="py-6 px-6 text-right font-black text-gray-900 text-xl">{formatRupiah(transaction.price)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-10">
          <div className="w-full max-w-sm space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-100 text-gray-600 font-bold">
              <span>Dasar Pengenaan Pajak</span>
              <span>{formatRupiah(transaction.price)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 text-sm text-gray-400 font-medium italic">
              <span>PPN (Sudah Termasuk)</span>
              <span>11%</span>
            </div>
            <div className="flex justify-between py-5 bg-gray-900 text-white px-8 rounded-2xl shadow-xl">
              <span className="font-black text-xl uppercase tracking-widest">Grand Total</span>
              <span className="font-black text-2xl">{formatRupiah(transaction.price)}</span>
            </div>
          </div>
        </div>

        <div className="mt-20 flex justify-between items-end">
          <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 max-w-xs">
             <p className="font-black text-[10px] text-blue-400 uppercase tracking-widest mb-3">Metode Pembayaran:</p>
             <p className="font-black text-blue-900 text-sm">BANK TRANSFER / CASH</p>
             <p className="text-xs text-blue-700 mt-1 font-medium italic">*Harap konfirmasi setelah melakukan pembayaran.</p>
          </div>
          <div className="text-center w-64">
            <p className="mb-24 text-sm font-bold text-gray-400 uppercase tracking-widest">Hormat Kami,</p>
            <div className="border-b-2 border-gray-900 w-full mb-2"></div>
            <p className="font-black text-gray-900 uppercase">{transaction.cashierName || 'Bagian Keuangan'}</p>
            <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest opacity-50">{companyInfo.name}</p>
          </div>
        </div>
      </div>

      {/* Tombol Kontrol di Bawah Preview (A4) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-[60] print:hidden w-full max-w-[400px] px-6">
          <button onClick={onClose} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold py-4 rounded-2xl shadow-2xl transition-all active:scale-95 border border-white/30">
            Kembali
          </button>
          <button onClick={onPrint} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-[0_15px_40px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-3">
            <Printer size={24} /> Cetak Invoice A4
          </button>
      </div>
    </div>
  );
};

export default ReceiptA4;
