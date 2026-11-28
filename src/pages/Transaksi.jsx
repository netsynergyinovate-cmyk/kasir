import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wifi, Printer, UserCheck, AlertCircle, CheckCircle2, Search, Receipt, Clock, Info, Eye, EyeOff, CreditCard, Calendar, Wallet, User, Banknote } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import MoneyInput from '../components/MoneyInput';
import { pickInvoiceNumber } from '../utils/runsnetSync';
import { isPaidThisMonth } from '../utils/visits';
import { hasPermission } from '../utils/permissions';
import './Transaksi.css';

// Cari nomor invoice asli Runsnet buat pelanggan ini (custid), timeout 6 detik supaya kasir
// tidak pernah terhambat lama kalau Runsnet lambat/mati — kalau gagal/timeout, null (nomor lokal
// dipakai sebagai cadangan, lihat pickInvoiceNumber).
async function lookupRunsnetInvoice({ query, localId, accessToken }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('/api/runsnet/invoice-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ query, localId }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.invoice || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const resolvePackageAndPrice = (cust, packagesList = []) => {
  if (!cust) return null;
  const rawPkg = cust.package || '';
  const cleanPkg = rawPkg.toLowerCase().trim();
  
  // 1. Jika pelanggan memiliki harga khusus yang tersimpan
  if (cust.price && Number(cust.price) > 0) {
    return {
      name: rawPkg || 'NET HOME 10 Mbps',
      price: Number(cust.price)
    };
  }

  // 2. Cocokkan dengan daftar master paket
  if (cleanPkg && packagesList && packagesList.length > 0) {
    const exact = packagesList.find(p => p.name.toLowerCase().trim() === cleanPkg);
    if (exact) return { name: exact.name, price: Number(exact.price) };

    const fuzzy = packagesList.find(p => 
      p.name.toLowerCase().includes(cleanPkg) || cleanPkg.includes(p.name.toLowerCase())
    );
    if (fuzzy) return { name: fuzzy.name, price: Number(fuzzy.price) };
  }

  // 3. Aturan Standar Berdasarkan Mbps (10 Mbps = 200rb, 15 Mbps = 250rb, 20 Mbps = 250rb)
  if (cleanPkg.includes('15') || cleanPkg.includes('15 mbps') || cleanPkg.includes('15mbps')) {
    return { name: rawPkg || 'NET HOME 15 Mbps', price: 250000 };
  }
  if (cleanPkg.includes('20') || cleanPkg.includes('20 mbps') || cleanPkg.includes('20mbps')) {
    return { name: rawPkg || 'NET HOME 20 Mbps', price: 250000 };
  }
  if (cleanPkg.includes('10') || cleanPkg.includes('10 mbps') || cleanPkg.includes('10mbps')) {
    return { name: rawPkg || 'NET HOME 10 Mbps', price: 200000 };
  }
  if (cleanPkg.includes('50') || cleanPkg.includes('50 mbps') || cleanPkg.includes('50mbps')) {
    return { name: rawPkg || 'NET HOME 50 Mbps', price: 400000 };
  }

  // 4. Default standar 10 Mbps = Rp 200.000
  return { name: rawPkg || 'NET HOME 10 Mbps', price: 200000 };
};

// Gaya bersama kartu & input halaman Transaksi (lega, tidak berdempetan di layar sempit maupun saat di-zoom).
const cardClass = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3.5';
const sectionTitleClass = 'flex items-center gap-2 text-sm font-semibold text-gray-800';
const labelClass = 'flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 mb-1.5';
// Tanpa warna latar, warna teks & ukuran huruf: masing-masing input menambahkan sendiri (kelas Tailwind yang bentrok tidak saling menimpa).
const inputClass = 'w-full border border-gray-200 rounded-xl outline-none transition-all focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

const Transaksi = ({ customers = [], transactions = [], packages = [], companyInfo, session, onComplete }) => {
  const [searchParams] = useSearchParams();
  const can = (perm) => hasPermission(session?.profile?.role, perm, session?.profile?.allowed_paths);
  const canRetail = can('pos.retail');
  const defaultCashierName = session?.profile?.full_name || (session?.profile?.role === 'superadmin' ? 'Super Admin' : (companyInfo?.adminName || 'Admin Kasir'));
  const [selectedCust, setSelectedCust] = useState('');
  // Paket yang dipilih kasir secara manual; kosong = pakai paket hasil resolusi dari data pelanggan
  const [packageOverride, setPackageOverride] = useState(null);
  const [amountPaid, setAmountPaid] = useState('');
  // null = ikuti status OTOMATIS dari jumlah bayar (lihat autoStatus); diisi kalau kasir menekan
  // tombol LUNAS/KASBON secara manual, dan direset lagi begitu jumlah bayar diubah.
  const [statusOverride, setStatusOverride] = useState(null);
  const [searchCust, setSearchCust] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pelanggan dari param URL (?cust= / ?customer=) dipilih otomatis sekali per nilai param,
  // begitu daftar pelanggan sudah dimuat. Disesuaikan saat render (bukan di effect) agar tidak render ganda.
  const custIdParam = searchParams.get('cust') || searchParams.get('customer_id');
  const custNameParam = searchParams.get('customer') || searchParams.get('name');
  const custParamKey = custIdParam ? `id:${custIdParam}` : (custNameParam ? `name:${custNameParam}` : null);
  const [appliedCustParam, setAppliedCustParam] = useState(null);
  if (custParamKey && custParamKey !== appliedCustParam && customers && customers.length > 0) {
    const found = custIdParam
      ? customers.find(c => String(c.id) === String(custIdParam) || String(c.custid) === String(custIdParam))
      : customers.find(c => (c.name || '').toLowerCase() === custNameParam.toLowerCase());
    if (found) {
      setAppliedCustParam(custParamKey);
      setSelectedCust(found.id);
      setPackageOverride(null);
    }
  }

  const selectedCustomerData = useMemo(
    () => (selectedCust ? customers.find(c => c.id === selectedCust) || null : null),
    [selectedCust, customers]
  );
  const activePackage = packageOverride || (selectedCustomerData ? resolvePackageAndPrice(selectedCustomerData, packages) : null);

  // Hanya LUNAS di kasir sendiri yang disembunyikan -- status PAID di billing Runsnet terpisah dari kasir,
  // jadi pelanggan yang dibayar langsung di Runsnet tetap bisa ditransaksikan di sini.
  const isPaidCustomer = (c) => isPaidThisMonth(c, transactions);
  const terminatedCount = customers.filter(c => c.status === 'terminate').length;
  const paidHiddenCount = customers.filter(c => c.status !== 'terminate' && isPaidCustomer(c)).length;
  const unpaidCustomers = customers.filter(c => c.status !== 'terminate' && !isPaidCustomer(c));
  const now = new Date();
  const periodLabel = `1–${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;

  // Saat kasir mengetik, pelanggan lunas ikut dicari (diberi badge LUNAS) — kalau tidak, nama yang sudah
  // bayar bulan ini tampil "tidak ditemukan" dan kasir mengira datanya hilang.
  const filteredCustomers = (showPaid || searchCust.trim() ? customers.filter(c => c.status !== 'terminate') : unpaidCustomers)
    .filter(c => {
      const term = searchCust.toLowerCase();
      const pppoe = String(c.pppoe_id || c.pppoeId || '').toLowerCase();
      const custIdStr = String(c.custid || c.customer_id || c.id || '').toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(term) ||
        (c.nickname && c.nickname.toLowerCase().includes(term)) ||
        (c.address || '').toLowerCase().includes(term) ||
        pppoe.includes(term) ||
        custIdStr.includes(term)
      );
    })
    // Diurutkan nama A-Z — memudahkan kasir menggulir mencari pelanggan saat lupa namanya
    // (kotak kosong menampilkan semua pelanggan, bukan cuma hasil ketikan). Pelanggan tanpa nama
    // (data lama/rusak) tetap muncul, diurutkan paling akhir, bukan bikin halaman blank.
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const payValue = Number(amountPaid) || 0;
  const change = activePackage && payValue > 0 ? payValue - activePackage.price : 0;

  // Kolom bayar masih kosong dianggap kasir akan bayar penuh (sama seperti perilaku submit di bawah);
  // begitu kasir benar-benar mengetik nominal kurang dari harga paket, status otomatis jadi KASBON —
  // supaya piutang & selisih data ke Runsnet tetap tercatat tanpa kasir perlu ingat menekan tombol.
  const effectivePaid = amountPaid === '' ? (activePackage?.price ?? 0) : payValue;
  const autoStatus = activePackage && effectivePaid < activePackage.price ? 'KASBON' : 'LUNAS';
  const status = statusOverride || autoStatus;

  const handleQuickPay = (amount) => {
    setAmountPaid(amount.toString());
    setStatusOverride(null);
  };

  const handleUangPas = () => {
    if (activePackage) {
      setAmountPaid(activePackage.price.toString());
      setStatusOverride(null);
    }
  };

  const handleSelectCustomer = (cust) => {
    setSelectedCust(cust.id);
    const pppoe = cust.pppoe_id || cust.pppoeId;
    const custId = cust.custid || cust.customer_id || cust.id;
    setSearchCust(`${cust.name} - [ID: ${custId}]${pppoe ? ` (${pppoe})` : ''}`);
    
    // Paket mengikuti aturan harga Mbps yang akurat (dihitung dari data pelanggan), tanpa override manual
    setPackageOverride(null);
    setAmountPaid('');
    setStatusOverride(null);
    setIsSearching(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    if (!selectedCustomerData) {
      alert('Wajib memilih pelanggan dari daftar dropdown / auto-complete!');
      return;
    }

    const currentPkg = activePackage || resolvePackageAndPrice(selectedCustomerData, packages);

    const bayar = Number(amountPaid) || currentPkg.price;
    const selectedDate = formData.get('printDate') ? new Date(formData.get('printDate')) : new Date();
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    const targetCust = selectedCustomerData;
    // PPPoE ID adalah pengenal unik utama di Runsnet, diikuti ID pelanggan Runsnet, lalu nama
    const lookupQuery = targetCust.pppoe_id || targetCust.pppoeId || targetCust.custid || targetCust.customer_id || targetCust.name;
    const custIdValue = targetCust.custid || targetCust.customer_id || targetCust.pppoe_id || targetCust.pppoeId || targetCust.id;
    const localId = `INV-${Date.now()}`;

    setIsSubmitting(true);
    const invoice = session?.access_token
      ? await lookupRunsnetInvoice({ query: lookupQuery, localId, accessToken: session.access_token })
      : null;
    setIsSubmitting(false);

    const newTransaction = {
      id: localId,
      invoiceNumber: pickInvoiceNumber({ localId, invoice }),
      date: selectedDate.toISOString(),
      custid: custIdValue,
      customerId: custIdValue,
      customer_id: custIdValue,
      customerName: targetCust.name,
      pppoeId: targetCust.pppoe_id || targetCust.pppoeId || null,
      packageName: currentPkg.name,
      price: Number(currentPkg.price) || 0,
      customerPhone: targetCust.phone || null,
      phone: targetCust.phone || null,
      status: status,
      paymentMethod: formData.get('paymentMethod') || 'Cash',
      amountPaid: Number(bayar) || Number(currentPkg.price) || 0,
      cashierName: formData.get('cashierName') || companyInfo?.adminName || 'Admin Utama',
      cashierId: session?.user?.id || null,
      type: 'retail'
    };

    onComplete(newTransaction);
    e.target.reset();
    setSelectedCust('');
    setPackageOverride(null);
    setSearchCust('');
    setAmountPaid('');
    setStatusOverride(null);
  };

  return (
    <div className="transaksi-container px-4 pt-4 pb-24 animate-in fade-in duration-300">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Judul + status. Status otomatis ikut jumlah bayar (kurang dari harga paket = KASBON), tombol cuma buat override manual */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
                <Receipt size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 leading-tight">Transaksi Retail</h2>
                <p className="text-xs text-gray-500">Periode {periodLabel}</p>
              </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button type="button" onClick={() => setStatusOverride('LUNAS')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${status === 'LUNAS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>
                <CheckCircle2 size={14} />
                LUNAS
              </button>
              <button type="button" onClick={() => setStatusOverride('KASBON')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${status === 'KASBON' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>
                <Clock size={14} />
                KASBON
              </button>
            </div>
          </div>
          {!statusOverride && (
            <p className="flex items-start gap-1.5 text-[11px] text-gray-400 leading-snug">
              <Info size={13} className="shrink-0 mt-px" />
              Otomatis dari jumlah bayar — kurang dari harga paket akan tercatat KASBON
            </p>
          )}
        </div>

        {/* Kartu Pelanggan (wajib pilih dari pencarian) */}
        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className={`${sectionTitleClass} whitespace-nowrap`}>
              <UserCheck size={16} className="text-blue-600" /> Pilih Pelanggan
            </h3>
            {selectedCustomerData && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} /> Tersambung
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{unpaidCustomers.length} belum bayar</span>
            {paidHiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPaid(v => !v)}
                aria-pressed={showPaid}
                className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition ${showPaid ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
              >
                {showPaid ? <Eye size={11} /> : <EyeOff size={11} />} {paidHiddenCount} lunas {showPaid ? 'ditampilkan' : 'disembunyikan'}
              </button>
            )}
            {terminatedCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1"><EyeOff size={11} /> {terminatedCount} terminate</span>
            )}
          </div>

          {/* Auto-complete Search Box */}
          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama, custid, atau PPPoE..."
                value={searchCust}
                onChange={(e) => {
                  setSearchCust(e.target.value);
                  setIsSearching(true);
                  if (!e.target.value) {
                    setSelectedCust('');
                    setPackageOverride(null);
                    setAmountPaid('');
                    setStatusOverride(null);
                  }
                }}
                onFocus={() => setIsSearching(true)}
                onBlur={() => setTimeout(() => setIsSearching(false), 150)}
                className={`${inputClass} pl-10 pr-3 py-2.5 text-sm ${selectedCustomerData ? 'border-emerald-400 bg-emerald-50/40 font-semibold text-emerald-900' : 'bg-gray-50 text-gray-800'}`}
              />
            </div>

            {isSearching && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                {filteredCustomers.length > 0 ? filteredCustomers.map(c => {
                  const pppoe = c.pppoe_id || c.pppoeId;
                  const custId = c.custid || c.customer_id || c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-semibold text-sm text-gray-800 min-w-0">
                          {c.name} {c.nickname && <span className="text-blue-600 font-normal">({c.nickname})</span>}
                          {isPaidCustomer(c) &&<span className="ml-1.5 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">LUNAS</span>}
                        </p>
                        <span className="shrink-0 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          custid: {custId}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2 mt-1 text-[11px] text-gray-500">
                        <span className="truncate">{c.address}</span>
                        {pppoe && <span className="shrink-0 font-mono text-blue-600 font-bold">{pppoe}</span>}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="p-4 text-center text-xs text-gray-400 italic">Pelanggan tidak ditemukan...</div>
                )}
              </div>
            )}
          </div>

          {/* Selected Customer Info Box */}
          {selectedCustomerData ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3.5 rounded-xl border border-blue-100 space-y-2 animate-in fade-in">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Pelanggan Terpilih</span>
                  <h4 className="font-bold text-gray-900 text-sm break-words">{selectedCustomerData.name}</h4>
                </div>
                <span className="bg-indigo-600 text-white font-mono font-bold text-[11px] px-2 py-1 rounded-lg">
                  custid: {selectedCustomerData.custid || selectedCustomerData.customer_id || selectedCustomerData.pppoe_id || selectedCustomerData.id}
                </span>
              </div>
              <div className="space-y-1.5 text-xs pt-2 border-t border-blue-100">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">ID PPPoE</span>
                  <span className="font-mono font-bold text-blue-700 text-right break-all min-w-0">{selectedCustomerData.pppoe_id || selectedCustomerData.pppoeId || '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">Paket Internet</span>
                  <span className="font-semibold text-gray-800 text-right min-w-0">{selectedCustomerData.package}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle size={16} className="shrink-0 mt-px text-amber-600" />
              <span>Kasir <strong>wajib memilih pelanggan</strong> dari pencarian di atas untuk menghindari kesalahan cocok data (no_match).</span>
            </div>
          )}
        </section>

        {/* Kartu Paket & Detail Transaksi */}
        <section className={cardClass}>
          <h3 className={sectionTitleClass}>
            <CreditCard size={16} className="text-blue-600" /> Detail Transaksi
          </h3>

          {activePackage && (
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 space-y-3">
              <div>
                <p className={labelClass}><Wifi size={13} /> Paket Berlangganan</p>
                {packages && packages.length > 0 ? (
                  <select
                    aria-label="Ganti Pilihan Paket"
                    value={activePackage.name}
                    disabled={!can('pos.custom_price')}
                    title={can('pos.custom_price') ? undefined : 'Belum diberi hak ubah harga oleh superadmin'}
                    onChange={(e) => {
                      const sel = packages.find(p => p.name === e.target.value);
                      if (sel) {
                        setPackageOverride({ name: sel.name, price: Number(sel.price) });
                        setAmountPaid(sel.price.toString());
                      }
                    }}
                    className={`${inputClass} bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 disabled:opacity-70`}
                  >
                    {packages.map(p => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} - {formatRupiah(p.price)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold text-gray-800 text-sm">{activePackage.name}</p>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-blue-100">
                <span className="text-xs text-gray-500 font-semibold">Total Tagihan</span>
                <span className="text-lg font-extrabold text-blue-700 leading-tight">{formatRupiah(activePackage.price)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}><Calendar size={13} /> Tanggal Cetak</label>
              <input name="printDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={`${inputClass} bg-gray-50 px-3 py-2.5 text-sm text-gray-800`} />
            </div>
            <div>
              <label className={labelClass}><Wallet size={13} /> Metode Pembayaran</label>
              <select name="paymentMethod" required className={`${inputClass} bg-gray-50 px-3 py-2.5 text-sm text-gray-800`}>
                <option value="Cash">Tunai (Cash)</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="QRIS">QRIS</option>
                <option value="CS">Bayar via CS</option>
              </select>
            </div>
            <div className="min-[360px]:col-span-2">
              <label className={labelClass}><User size={13} /> Nama Penerima/Kasir</label>
              <input name="cashierName" type="text" defaultValue={defaultCashierName} placeholder="Nama Admin / Kasir" className={`${inputClass} bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800`} />
            </div>
          </div>
        </section>

        {/* Kartu Pembayaran */}
        <section className={cardClass}>
          <h3 className={sectionTitleClass}>
            <Banknote size={16} className="text-blue-600" /> Jumlah Bayar
          </h3>

          <div className="flex flex-col min-[380px]:flex-row gap-3">
            <MoneyInput
              name="amountPaid"
              value={amountPaid}
              onValueChange={(v) => { setAmountPaid(v); setStatusOverride(null); }}
              prefix="Rp"
              placeholder="0"
              aria-label="Uang diterima"
              wrapperClassName="flex-1 min-w-0"
              className={`${inputClass} bg-gray-50 px-4 py-3 text-2xl font-extrabold text-blue-600 placeholder:text-gray-300`}
            />
            {/* Change Result */}
            {amountPaid && (
              <div className={`min-[380px]:w-36 shrink-0 px-4 py-2.5 rounded-xl flex min-[380px]:flex-col justify-between min-[380px]:justify-center items-center min-[380px]:items-end gap-1 animate-in zoom-in duration-200 ${change >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <span className="text-[11px] font-bold text-gray-500 uppercase">{change >= 0 ? 'Kembalian' : 'Kurang'}</span>
                <span className={`text-base font-extrabold leading-tight ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatRupiah(Math.abs(change))}
                </span>
              </div>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleUangPas}
              className="py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
            >
              UANG PAS
            </button>
            {[50000, 100000, 200000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickPay(amt)}
                className="py-2.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 active:scale-95 active:bg-blue-600 active:text-white transition-all tap-bounce"
              >
                {formatRupiah(amt)}
              </button>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={!canRetail || !selectedCustomerData || !activePackage || isSubmitting}
          className={`w-full text-white font-bold text-base py-3.5 rounded-2xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95 ${
            selectedCustomerData && activePackage
              ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-blue-300 animate-pulse-glow hover:scale-[1.01]'
              : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
          }`}
        >
          <Printer size={18} /> {!canRetail ? 'Belum diberi hak proses pembayaran' : !selectedCustomerData ? 'Pilih Pelanggan Dulu' : (isSubmitting ? 'Menyamakan Nomor Invoice...' : 'Cetak Struk (58mm)')}
        </button>
      </form>
    </div>
  );
};

export default Transaksi;
