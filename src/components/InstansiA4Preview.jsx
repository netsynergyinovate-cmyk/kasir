import { useMemo } from 'react';
import {
  UserCircle, IdCard, MapPin, FileText, Calendar, CalendarX2, Wallet, Info, Landmark,
  CreditCard, User, Share2, Mail, Wifi, Contact, Headset, Quote, CheckCircle2, Clock, Globe,
} from 'lucide-react';
import { formatDateIndo, formatNumber } from '../utils/instansiInvoice';

// Replika visual persis dari template invoice A4 aplikasi invoicing lama (InvoiceA4Preview.tsx):
// markup & warna dipertahankan sama supaya dokumen yang diterbitkan KAsir tidak berbeda dari yang
// sudah pernah dikirim ke klien. Ikon Material Symbols (tidak dimuat di KAsir) diganti ikon lucide
// setara; font/warna/ukuran/tata letak lainnya identik.

function Barcode({ value }) {
  const code39Map = {
    '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
    '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
    '8': '110100101101', '9': '101100101101', A: '110101001011', B: '101101001011',
    C: '110110100101', D: '101011001011', E: '110101100101', F: '101101100101',
    G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
    K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011',
    O: '110101101001', P: '101101101001', Q: '101010110011', R: '110101011001',
    S: '101101011001', T: '101011011001', U: '110010101011', V: '100110101011',
    W: '110011010101', X: '100101101011', Y: '110010110101', Z: '100110110101',
    '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
    $: '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001',
  };

  const normalizedValue = `*${value.toUpperCase()}*`;
  let binaryString = '';
  for (let i = 0; i < normalizedValue.length; i++) {
    const char = normalizedValue[i];
    binaryString += (code39Map[char] || code39Map['-']) + '0';
  }

  let pathD = '';
  binaryString.split('').forEach((bit, idx) => {
    if (bit === '1') pathD += `M${idx},0 h1 v100 h-1 z `;
  });

  return (
    <div className="flex flex-col items-center">
      <svg className="h-6 w-56" viewBox={`0 0 ${binaryString.length} 100`} preserveAspectRatio="none" style={{ shapeRendering: 'crispEdges' }}>
        <path d={pathD} fill="#0f172a" />
      </svg>
      <span className="font-mono text-[9px] mt-0.5 text-[#44474d] tracking-widest">{value}</span>
    </div>
  );
}

const ITEMS_PER_PAGE = 10;
const chunkItems = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks.length > 0 ? chunks : [[]];
};

const InstansiA4Preview = ({ invoiceData, lineItems, subtotal, profile }) => {
  const isFaktur = invoiceData.invoiceNumber?.startsWith('FKT-');

  const servicePeriod = useMemo(() => {
    if (!invoiceData.issuedDate || !invoiceData.dueDate) return '';
    return `${formatDateIndo(invoiceData.issuedDate)} - ${formatDateIndo(invoiceData.dueDate)}`;
  }, [invoiceData.issuedDate, invoiceData.dueDate]);

  if (isFaktur) {
    const totalAmount = parseFloat(invoiceData.amount || subtotal?.toString()) || 0;
    const servicePkg = invoiceData.servicePackage?.includes('Paket')
      ? invoiceData.servicePackage
      : (invoiceData.servicePackage ? `Paket ${invoiceData.servicePackage} & Router NSI-Pro` : 'Paket Fiber Optic 50Mbps & Router NSI-Pro');

    return (
      <div className="bg-white rounded-sm shadow-2xl flex flex-col p-[50px] relative text-[#111827] mx-auto printable-invoice print:shadow-none print:p-[50px] print:m-0" style={{ width: '210mm', minHeight: '297mm' }}>
        <div className="flex flex-col h-full text-[11px] leading-tight text-slate-900 w-full mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-4">
              {profile?.logoUrl ? (
                <div className="w-14 h-14 shrink-0 overflow-hidden flex items-center justify-center">
                  <img src={profile.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-[#1b2b48] text-white rounded-md flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Share2 size={28} />
                </div>
              )}
              <div>
                <h1 className="font-bold text-[24px] text-[#1b2b48] mb-0 tracking-tight leading-tight uppercase">{profile?.companyName || 'PT NET SYNERGY INOVATE'}</h1>
                <p className="text-[12px] text-[#44474d] max-w-md leading-tight opacity-90 whitespace-pre-line">
                  {profile?.address || '-'}
                  {'\n'}Email: {profile?.csEmail || '-'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="font-bold text-[32px] text-[#0051d5] uppercase tracking-tight mb-0 leading-none">FAKTUR<div>PEMBAYARAN</div></h2>
              <div className="text-[12px] font-semibold tracking-widest text-[#44474d] uppercase mt-1">INVOICE RESMI</div>
            </div>
          </div>

          <hr className="border-[#e0e2ec] mb-3" />

          {/* Info */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-[#f0f4fa] rounded-md border border-[#e0e2ec]/50 shadow-sm p-3">
              <div className="flex items-center gap-2 mb-1">
                <UserCircle size={18} className="text-[#1b2b48]" />
                <div className="text-[12px] font-semibold tracking-wider text-[#1b2b48] uppercase">Telah diterima dari :</div>
              </div>
              <div className="text-[18px] font-semibold text-[#0b1c30] mb-0.5 uppercase">{invoiceData.institutionName || '-'}</div>
              <div className="flex items-center gap-2 text-[12px] text-[#44474d] mb-1">
                <IdCard size={14} className="text-[#1b2b48]" /> ID Pelanggan: {invoiceData.clientId || '-'}
              </div>
              <div className="flex items-start gap-2 text-[12px] text-[#44474d] leading-tight">
                <MapPin size={14} className="mt-0.5 shrink-0" /> <div>{invoiceData.address || '-'}</div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-0.5">
              <div className="flex justify-between py-1.5 border-b border-[#e0e2ec] items-center">
                <div className="flex items-center gap-2"><FileText size={18} className="text-[#1b2b48]" /><span className="text-[#44474d] text-[12px] font-semibold">No. Faktur</span></div>
                <span className="font-mono font-bold text-[#1b2b48]">{invoiceData.invoiceNumber || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#e0e2ec] items-center">
                <div className="flex items-center gap-2"><Calendar size={18} className="text-[#1b2b48]" /><span className="text-[#44474d] text-[12px] font-semibold">Tanggal</span></div>
                <span className="font-mono text-[14px] text-[#0b1c30]">{formatDateIndo(invoiceData.issuedDate)}</span>
              </div>
              <div className="flex justify-between py-1.5 items-center">
                <div className="flex items-center gap-2"><CalendarX2 size={18} className="text-[#ba1a1a]" /><span className="text-[#44474d] text-[12px] font-semibold">Jatuh Tempo</span></div>
                <span className="font-mono text-[14px] text-[#ba1a1a] font-medium">{formatDateIndo(invoiceData.dueDate)}</span>
              </div>
            </div>
          </div>

          {/* Tabel */}
          <div className="mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#1b2b48] text-white">
                  <th className="px-4 text-left text-[12px] font-semibold py-1.5 rounded-l-lg">Deskripsi Layanan</th>
                  <th className="px-4 text-center text-[12px] font-semibold w-16 py-1.5">Qty</th>
                  <th className="px-4 text-right text-[12px] font-semibold w-32 py-1.5">Harga Satuan</th>
                  <th className="px-4 text-right text-[12px] font-semibold rounded-r-lg w-32 py-1.5">Jumlah</th>
                </tr>
              </thead>
              <tbody className="text-[14px]">
                <tr className="border-b border-[#e0e2ec]">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-[#0b1c30]">Layanan Internet & Sewa Perangkat</div>
                    <div className="text-[#44474d] text-[12px] mt-0.5">{servicePkg}</div>
                    {servicePeriod && <div className="text-[#44474d] text-[11px] italic mt-0.5">Periode: {servicePeriod}</div>}
                  </td>
                  <td className="px-4 text-center text-[#44474d] py-2.5">1</td>
                  <td className="px-4 text-right font-mono text-[#44474d] py-2.5">Rp {formatNumber(totalAmount)}</td>
                  <td className="px-4 text-right font-mono text-[#0b1c30] font-medium py-2.5">Rp {formatNumber(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Catatan */}
          <div className="bg-[#f8f9ff] rounded-md border border-[#e0e2ec]/50 border-l-4 border-l-[#1b2b48] shadow-sm p-2.5 mb-3">
            <div className="flex items-center gap-2 mb-1 text-[#1b2b48]"><Info size={18} /><h3 className="text-[11px] font-semibold tracking-wider uppercase">Catatan Administrasi</h3></div>
            <p className="text-[11px] text-[#44474d] leading-snug whitespace-pre-line">
              Biaya langganan mencakup pemeliharaan rutin dan dukungan teknis 24/7. Pastikan pembayaran sebelum jatuh tempo untuk menghindari penangguhan otomatis.
              <span className="block font-semibold text-[#1b2b48] mt-1">{profile?.csPhone ? `Layanan Pengaduan: ${profile.csPhone} | WA: ${profile.csPhone}` : 'Layanan Pengaduan: -'}</span>
            </p>
          </div>

          {/* Ringkasan */}
          <div className="flex justify-between items-start gap-4">
            <div className="w-[58%]">
              <div className="bg-[#d3e4fe] border border-[#1b2b48]/10 rounded-md shadow-sm p-2.5 mb-2">
                <div className="flex items-center gap-2 mb-1"><Wallet size={18} className="text-[#1b2b48]" /><div className="text-[11px] text-[#1b2b48] font-semibold tracking-wider uppercase">Terbilang:</div></div>
                <div className="text-[14px] text-[#1b2b48] font-semibold italic leading-tight pl-4 border-l border-[#1b2b48]/20">&quot;{invoiceData.amountInWords}&quot;</div>
              </div>

              <div className="bg-[#eff4ff] border border-[#e0e2ec] rounded-md p-2.5">
                <div className="text-[10px] text-[#1b2b48] font-bold uppercase tracking-wider mb-1.5">DETAIL REKENING PEMBAYARAN:</div>
                <div className="flex flex-col gap-1 text-[12px]">
                  <div className="flex items-center justify-between border-b border-[#e0e2ec]/50 pb-1">
                    <div className="flex items-center gap-2"><Landmark size={14} className="text-[#1b2b48]" /><span className="text-[#44474d]">Bank:</span></div>
                    <span className="font-semibold text-[#0b1c30]">{profile?.bankName || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#e0e2ec]/50 pb-1">
                    <div className="flex items-center gap-2"><CreditCard size={14} className="text-[#1b2b48]" /><span className="text-[#44474d]">No. Rek:</span></div>
                    <span className="font-mono font-bold text-[#0b1c30]">{profile?.bankAccount || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><User size={14} className="text-[#1b2b48]" /><span className="text-[#44474d]">A/N:</span></div>
                    <span className="font-medium text-[#0b1c30]">{profile?.bankHolder || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[#1b2b48] text-[11px] font-semibold flex items-center gap-2">
                STATUS:{' '}
                {invoiceData.status?.toUpperCase() === 'PAID' || invoiceData.status?.toUpperCase() === 'LUNAS' ? (
                  <span className="bg-[#dcfce7] text-[#166534] px-3 py-0.5 rounded font-bold text-[10px] tracking-widest uppercase border border-[#166534]/20">LUNAS</span>
                ) : (
                  <span className="bg-[#ffdad6] text-[#ba1a1a] px-3 py-0.5 rounded font-bold text-[10px] tracking-widest uppercase border border-[#ba1a1a]/20">BELUM LUNAS</span>
                )}
              </div>
            </div>

            <div className="w-[40%] bg-[#f0f4fa] rounded-md overflow-hidden border border-[#e0e2ec]/30">
              <table className="w-full text-body-md">
                <tbody>
                  <tr className="border-b border-[#e0e2ec]/30">
                    <td className="pl-4 py-2 text-[12px] text-[#44474d] font-semibold">Subtotal</td>
                    <td className="pr-4 text-right font-mono py-2">Rp {formatNumber(totalAmount)}</td>
                  </tr>
                  <tr className="border-b border-[#e0e2ec]/30">
                    <td className="pl-4 py-2 text-[12px] text-[#44474d] font-semibold">Pajak &amp; Biaya</td>
                    <td className="pr-4 text-right font-mono py-2 text-[11px] font-semibold text-slate-500">Sudah Termasuk PPN 11%</td>
                  </tr>
                  <tr className="bg-[#1b2b48] text-white">
                    <td className="pl-4 py-3 font-bold uppercase tracking-wider text-[11px]">Total Tagihan</td>
                    <td className="pr-4 text-right font-mono font-bold text-lg py-3">Rp {formatNumber(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tanda tangan */}
          <div className="mt-6">
            <div className="flex justify-between items-end mb-2">
              <div className="text-left">
                <div className="text-[10px] text-[#44474d]">Lokasi &amp; Waktu Penerbitan:</div>
                <div className="font-medium text-[#0b1c30] text-[11px]">{invoiceData.issuancePlace || '-'}, {formatDateIndo(invoiceData.issuanceDate || invoiceData.issuedDate)}</div>
              </div>
            </div>
            <div className="flex justify-between items-end gap-[24px]">
              <div className="text-center w-64">
                <div className="text-[10px] text-[#44474d] uppercase tracking-widest" style={{ marginBottom: '70px' }}>Tanda Tangan Pelanggan</div>
                <div className="text-[14px] text-[#44474d] font-medium">({invoiceData.institutionName || '....................................'})</div>
              </div>
              <div className="text-center w-64">
                <div className="text-[10px] text-[#44474d] uppercase tracking-widest" style={{ marginBottom: '70px' }}>Authorized Signature</div>
                <div className="text-[14px] text-[#1b2b48] font-bold leading-none">Finance Department</div>
                <div className="font-mono text-[9px] text-[#44474d] uppercase tracking-tighter mt-1">NSI-FIN-24A-9X</div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-[#e0e2ec]">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <p className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wide">PENTING / NOTICE:</p>
                <p className="text-[11px] text-[#44474d] font-semibold leading-tight">Dokumen ini merupakan bukti pembayaran yang sah. Harap disimpan sebagai arsip transaksi Anda.</p>
                <p className="text-[11px] text-slate-400 mt-0.5 italic">Terima kasih atas kepercayaan Anda memilih layanan {profile?.companyName || 'PT NET SYNERGY INOVATE'}.</p>
              </div>
              <div><Barcode value={invoiceData.invoiceNumber || 'FKT-000'} /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Template Invoice (tagihan, bisa multi-halaman) ----
  const companyLogo = profile?.logoUrl;
  const companyName = profile?.companyName || 'PT NET SYNERGY INOVATE';
  const pages = chunkItems(lineItems || [], ITEMS_PER_PAGE);
  const totalPages = pages.length;
  const isPaid = invoiceData.status?.toUpperCase() === 'LUNAS' || invoiceData.status === 'paid';

  return (
    <div className="flex flex-col gap-8 w-full print:block print:gap-0">
      {pages.map((pageItems, pageIdx) => {
        const isLastPage = pageIdx === totalPages - 1;
        return (
          <div key={pageIdx} className="bg-white rounded-sm shadow-2xl flex flex-col p-[50px] relative text-[#111827] mx-auto printable-invoice print:shadow-none print:p-[50px] print:m-0" style={{ width: '210mm', minHeight: '297mm' }}>
            <div className="flex flex-col h-full bg-white relative text-[11px] leading-tight text-slate-900 w-full mx-auto">
              <div className="w-full">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-start gap-4">
                    {companyLogo ? (
                      <div className="w-14 h-14 shrink-0 overflow-hidden flex items-center justify-center">
                        <img src={companyLogo} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-[#00288e] flex items-center justify-center rounded-xl shadow-sm shrink-0">
                        <Globe size={28} className="text-white" />
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-[#00288e] tracking-tight leading-tight uppercase">{companyName}</h1>
                      <p className="text-[11px] text-[#006591] italic font-semibold">{profile?.companyId || 'Innovative Connections Everywhere'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <h2 className="text-3xl font-black text-[#1e1b4b] tracking-wider uppercase leading-none text-right">INVOICE</h2>
                    <div className={`px-4 py-1.5 rounded-full flex items-center gap-1 border ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {isPaid ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      <span className="font-bold text-[9px] uppercase tracking-wider">{isPaid ? 'LUNAS / PAID' : (invoiceData.status?.toUpperCase() || 'PENDING')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-5 pb-4 border-b-2 border-slate-100">
                  <div className="text-[11px] text-slate-500 space-y-1.5">
                    <div className="flex items-center gap-2.5"><Mail size={16} className="text-[#00288e]" /><span className="font-semibold text-slate-700">{profile?.csEmail || '-'}</span></div>
                    <div className="flex items-start gap-2.5 max-w-[320px]"><MapPin size={16} className="text-[#00288e] shrink-0" /><span className="leading-relaxed">{profile?.address || '-'}</span></div>
                  </div>
                  <div className="bg-white border-2 border-slate-100 p-3.5 rounded-2xl flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100"><Wifi size={22} className="text-[#00288e]" /></div>
                    <div className="flex flex-col">
                      <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-[0.15em]">PAKET LAYANAN</p>
                      <p className="font-black text-[#00288e] text-[15px] leading-tight">{invoiceData.servicePackage || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-5 mb-5 items-stretch">
                  <div className="col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                      <Contact size={14} className="text-[#00288e]" />
                      <span className="text-[10px] font-bold text-[#00288e] uppercase tracking-wider">DITAGIHKAN KEPADA <span className="italic font-normal opacity-70">/ BILL TO</span></span>
                    </div>
                    <div className="p-4 flex-1 space-y-2">
                      <h2 className="font-bold text-base text-[#00288e] mb-1 uppercase tracking-tight">{invoiceData.institutionName}</h2>
                      <div className="grid grid-cols-[85px_1fr] text-[11px] gap-y-1">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Client ID</span>
                        <span className="text-slate-800 font-bold">: {invoiceData.clientId}</span>
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Email</span>
                        <span className="text-slate-800 font-bold">: {invoiceData.email}</span>
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Alamat</span>
                        <span className="text-slate-800 leading-snug font-medium">: {invoiceData.address}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-5 flex flex-col gap-3">
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">No. Invoice <span className="italic font-normal opacity-70">/ Invoice Number</span></p></div>
                      <div className="px-3 py-2"><p className="text-[17px] font-black text-[#00288e] tracking-tight leading-none">{invoiceData.invoiceNumber}</p></div>
                    </div>
                    <div className="grid grid-cols-2 border border-slate-100 rounded-xl p-3 gap-3 shadow-sm bg-white">
                      <div className="flex flex-col"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tanggal</p><p className="font-bold text-[11px] text-slate-800">{invoiceData.issuedDate}</p></div>
                      <div className="flex flex-col items-end text-right"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tempo</p><p className="font-bold text-[11px] text-rose-600">{invoiceData.dueDate}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 border border-amber-100 bg-amber-50/50 rounded-xl p-2 text-center"><p className="text-[8px] text-amber-700 font-bold uppercase">Metode</p><p className="font-black text-[11px] text-amber-700 uppercase tracking-tight">{invoiceData.method || 'TRANSFER'}</p></div>
                      <div className={`flex-1 rounded-xl p-2 text-center shadow-md ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}><p className="text-[8px] text-white/90 font-bold uppercase">Status</p><p className="font-black text-[11px] text-white uppercase tracking-tight">{invoiceData.status}</p></div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#00288e] text-white text-[11px]">
                        <th className="px-6 py-3 font-bold uppercase text-left tracking-wider">Keterangan</th>
                        <th className="px-6 py-3 font-bold uppercase text-left tracking-wider">Deskripsi</th>
                        <th className="px-6 py-3 font-bold uppercase text-center tracking-wider">Satuan</th>
                        <th className="px-6 py-3 font-bold uppercase text-right tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px]">
                      {pageItems.map((item, idx) => {
                        const isDenda = item.type?.toLowerCase() === 'denda';
                        return (
                          <tr key={idx} className={`border-b border-slate-50 last:border-0 ${isDenda ? 'bg-rose-50/50' : 'hover:bg-slate-50/30'}`}>
                            <td className={`px-6 py-3.5 font-bold ${isDenda ? 'text-rose-600' : 'text-[#00288e]'}`}>{item.type || '-'}</td>
                            <td className={`px-6 py-3.5 font-medium ${isDenda ? 'text-rose-500 italic' : 'text-slate-700'}`}>{item.description || '-'}</td>
                            <td className={`px-6 py-3.5 text-center font-bold ${isDenda ? 'text-rose-600' : 'text-slate-800'}`}><div className="flex items-center justify-center gap-1"><span>Rp</span><span>{formatNumber(item.price)}</span></div></td>
                            <td className={`px-6 py-3.5 text-right font-black text-[13px] ${isDenda ? 'text-rose-600' : 'text-[#00288e]'}`}><div className="flex items-center justify-end gap-1"><span>Rp</span><span>{formatNumber(item.price)}</span></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {isLastPage ? (
                  <div className="grid grid-cols-12 gap-6 mb-5">
                    <div className="col-span-6 space-y-3">
                      <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl shadow-sm">
                        <p className="font-black text-[9px] text-[#00288e] uppercase tracking-widest flex items-center gap-1.5 mb-3"><Landmark size={15} /> INFORMASI PEMBAYARAN <span className="italic font-normal opacity-70 ml-1">/ Payment</span></p>
                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className="border-l-2 border-slate-100 pl-3.5">
                            <p className="font-black text-[14px] tracking-tight text-[#00288e] leading-none mb-1">{profile?.bankAccount || '-'}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase leading-none">a.n {profile?.bankHolder || companyName} ({profile?.bankName || '-'})</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-black text-[9px] text-[#00288e] uppercase tracking-widest flex items-center gap-1.5"><Headset size={14} /> DUKUNGAN PELANGGAN <span className="italic font-normal opacity-70 ml-1">/ Customer Support</span></p>
                        <div className="text-[10px] font-bold text-slate-800 ml-5 mt-1">WhatsApp: {profile?.csPhone || '-'}</div>
                        <div className="text-[8px] text-slate-500 leading-tight border-t border-slate-50 pt-1 ml-5">
                          <p>• Bayar sebelum tempo untuk menghindari denda.</p>
                          <p>• Simpan bukti transfer valid jika diperlukan.</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-6 space-y-3 flex flex-col">
                      <div className="bg-[#00288e] text-white p-5 rounded-2xl flex items-center justify-between shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                          <p className="text-[12px] font-black uppercase tracking-widest leading-tight">TOTAL TAGIHAN</p>
                          <p className="text-[8px] text-blue-200 font-bold uppercase tracking-wider">GRAND TOTAL AMOUNT</p>
                        </div>
                        <div className="flex items-baseline gap-2 text-4xl font-black relative z-10">
                          <span className="text-[16px] font-bold text-blue-200">Rp</span><span>{formatNumber(subtotal)}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-50 rounded-full shadow-sm flex items-center justify-center border border-yellow-100 shrink-0"><Quote size={22} className="text-yellow-400 scale-x-[-1]" /></div>
                        <div className="flex-1">
                          <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mb-0.5">Terbilang <span className="italic font-normal opacity-70 ml-1">/ Amount in words</span></p>
                          <p className="font-black italic text-[#00288e] text-[11px] uppercase leading-snug">&quot; {invoiceData.amountInWords} &quot;</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-5 p-4 text-center text-slate-500 font-bold border-t border-slate-200">Bersambung ke Halaman {pageIdx + 2} / Continued on Page {pageIdx + 2}</div>
                )}
              </div>

              <div className="w-full mt-auto">
                <div className="flex flex-col gap-3 pb-2">
                  <div className="grid grid-cols-3 items-center mb-3">
                    <div className="text-left">{totalPages > 1 && <p className="text-[10px] text-slate-400 font-bold">Halaman {pageIdx + 1} dari {totalPages}</p>}</div>
                    <div className="text-center">
                      {(invoiceData.issuancePlace || invoiceData.issuanceDate) && (
                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight bg-slate-50 px-3 py-1 rounded-full border border-slate-100 inline-block">
                          {invoiceData.issuancePlace}{invoiceData.issuancePlace && invoiceData.issuanceDate ? ', ' : ''}{invoiceData.issuanceDate}
                        </p>
                      )}
                    </div>
                    <div className="text-right" />
                  </div>

                  <div className="grid grid-cols-2 gap-16">
                    <div className="text-center flex flex-col items-center">
                      <div className="flex flex-col items-center">
                        <p className="text-[11px] text-slate-500 font-bold leading-none">Customer,</p>
                        <p className="text-[11px] font-black text-[#00288e] uppercase mt-1.5 leading-none">{invoiceData.institutionName || '-'}</p>
                        <div className="h-[75px]" />
                        <p className="text-[8px] text-slate-400 italic mb-1 uppercase tracking-wider">Customer Signature</p>
                      </div>
                      <div className="w-full max-w-[200px] border-t-2 border-slate-900 pt-2"><p className="font-black text-slate-900 text-[10px] uppercase tracking-tighter">BENDAHARA INSTANSI</p></div>
                    </div>
                    <div className="text-center flex flex-col items-center">
                      <div className="flex flex-col items-center">
                        <p className="text-[11px] text-slate-500 font-bold leading-none">Authorized By,</p>
                        <p className="text-[11px] font-black text-[#00288e] uppercase mt-1.5 leading-none">{companyName}</p>
                        <div className="h-[75px]" />
                        <p className="text-[8px] text-slate-400 italic mb-1 uppercase tracking-wider">Official Signature</p>
                      </div>
                      <div className="w-full max-w-[200px] border-t-2 border-slate-900 pt-2"><p className="font-black text-slate-900 text-[10px] uppercase tracking-tighter">ADMINISTRATOR NSI</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InstansiA4Preview;
