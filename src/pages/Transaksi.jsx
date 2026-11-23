import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wifi, Printer, UserCheck, AlertCircle, CheckCircle2, Search } from 'lucide-react';
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

  // Pelanggan yang sudah LUNAS bulan ini tidak perlu muncul lagi di daftar pembayaran.
  const unpaidCustomers = customers.filter(c => !isPaidThisMonth(c, transactions));
  const paidHiddenCount = customers.length - unpaidCustomers.length;

  const filteredCustomers = unpaidCustomers
    .filter(c => {
      const term = searchCust.toLowerCase();
      const pppoe = (c.pppoe_id || c.pppoeId || '').toLowerCase();
      const custIdStr = (c.custid || c.customer_id || c.id || '').toLowerCase();
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
    <div className="transaksi-container p-3 pb-20 animate-in fade-in duration-300">
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Status Toggle — otomatis ikut jumlah bayar (kurang dari harga paket = KASBON), tombol ini cuma buat override manual */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-sm font-bold text-gray-800 leading-tight">Transaksi Pembayaran Retail</h2>
            <div className="flex bg-gray-100 p-0.5 rounded-lg w-40">
               <button type="button" onClick={() => setStatusOverride('LUNAS')} className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${status === 'LUNAS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>LUNAS</button>
               <button type="button" onClick={() => setStatusOverride('KASBON')} className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${status === 'KASBON' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>KASBON</button>
            </div>
          </div>
          {!statusOverride && (
            <p className="text-[10px] text-gray-400 text-right">Otomatis dari jumlah bayar — kurang dari harga paket akan tercatat KASBON</p>
          )}
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 space-y-2.5">
          {/* Customer Selection Section (Mandatory Dropdown & Auto-complete) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <UserCheck size={14} className="text-blue-600"/> Pilih Pelanggan
              </label>
              {selectedCustomerData && (
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12}/> Tersambung
                </span>
              )}
            </div>

            {paidHiddenCount > 0 && (
              <p className="text-[11px] text-gray-400 -mt-1">{paidHiddenCount} pelanggan yang sudah lunas bulan ini tidak ditampilkan.</p>
            )}

            {/* Auto-complete Search Box */}
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ketik nama, atau klik untuk lihat semua pelanggan..."
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
                  className={`w-full pl-8 pr-3 py-2 bg-gray-50 border rounded-lg outline-none text-xs font-medium transition-all ${selectedCustomerData ? 'border-emerald-500 bg-emerald-50/20 font-bold text-emerald-900' : 'border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                />
              </div>

              {isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {filteredCustomers.length > 0 ? filteredCustomers.map(c => {
                    const pppoe = c.pppoe_id || c.pppoeId;
                    const custId = c.custid || c.customer_id || c.id;
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => handleSelectCustomer(c)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-xs text-gray-800">
                            {c.name} {c.nickname && <span className="text-blue-600 font-normal">({c.nickname})</span>}
                          </p>
                          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            custid: {custId}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[10px] text-gray-500">
                          <span>{c.address}</span>
                          {pppoe && <span className="font-mono text-blue-600 font-bold">{pppoe}</span>}
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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 rounded-xl border border-blue-200 space-y-0.5 animate-in fade-in">
                <div className="flex justify-between items-center gap-2">
                  <h4 className="min-w-0 font-extrabold text-gray-900 text-xs leading-tight truncate" title="Pelanggan Terpilih">{selectedCustomerData.name}</h4>
                  <span className="bg-indigo-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-md shadow-sm shrink-0">
                    custid: {selectedCustomerData.custid || selectedCustomerData.customer_id || selectedCustomerData.pppoe_id || selectedCustomerData.id}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="truncate">
                    <span className="text-gray-500 text-[10px]">ID PPPoE: </span>
                    <span className="font-mono font-bold text-blue-700">{selectedCustomerData.pppoe_id || selectedCustomerData.pppoeId || '-'}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-gray-500 text-[10px]">Paket: </span>
                    <span className="font-bold text-gray-800">{selectedCustomerData.package}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0 text-amber-600" />
                <span>Kasir <strong>wajib memilih pelanggan</strong> dari pencarian di atas untuk menghindari kesalahan cocok data (no_match).</span>
              </div>
            )}
          </div>

          {activePackage && (
            <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-blue-600 font-bold uppercase flex items-center gap-1"><Wifi size={11}/> Paket Berlangganan</p>
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
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {packages.map(p => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} - {formatRupiah(p.price)}
                      </option>
                    ))}
                  </select>
              ) : (
                <p className="font-bold text-gray-800 text-xs">{activePackage.name}</p>
              )}
              </div>
              <div className="text-right shrink-0">
                <span className="block text-[10px] text-gray-500 font-semibold">Total Tagihan</span>
                <span className="text-base font-black text-blue-700 leading-tight">{formatRupiah(activePackage.price)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5 ml-1">Tanggal Cetak</label>
              <input name="printDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-[11px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5 ml-1 truncate" title="Nama Penerima/Kasir">Penerima/Kasir</label>
              <input name="cashierName" type="text" defaultValue={defaultCashierName} placeholder="Nama Admin / Kasir" className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-xs font-bold text-gray-800" />
            </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5 ml-1 truncate" title="Metode Pembayaran">Metode Bayar</label>
            <select name="paymentMethod" required className="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs">
              <option value="Cash">Tunai (Cash)</option>
              <option value="Transfer Bank">Transfer Bank</option>
              <option value="QRIS">QRIS</option>
              <option value="CS">Bayar via CS</option>
            </select>
          </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5 ml-1">Jumlah Bayar (Rp)</label>
              <div className="flex gap-2">
              <MoneyInput
                name="amountPaid"
                value={amountPaid}
                onValueChange={(v) => { setAmountPaid(v); setStatusOverride(null); }}
                prefix="Rp"
                placeholder="0"
                aria-label="Uang diterima"
                wrapperClassName="flex-1 min-w-0"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xl font-black text-blue-600 placeholder:text-gray-300"
              />
            {/* Change Result — sebaris dengan input supaya halaman muat satu layar */}
            {amountPaid && (
              <div className={`shrink-0 w-32 px-3 py-1 rounded-xl flex flex-col justify-center items-end animate-in zoom-in duration-200 ${change >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <span className="text-[10px] font-bold text-gray-500 uppercase">{change >= 0 ? 'Kembalian' : 'Kurang'}</span>
                <span className={`text-sm font-black leading-tight ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatRupiah(Math.abs(change))}
                </span>
              </div>
            )}
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleUangPas}
                className="py-1.5 text-[10px] font-black bg-blue-600 text-white rounded-lg shadow-sm shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
              >
                UANG PAS
              </button>
              {[50000, 100000, 200000].map((amt) => (
                <button 
                  key={amt} 
                  type="button" 
                  onClick={() => handleQuickPay(amt)}
                  className="py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600 active:scale-95 active:bg-blue-600 active:text-white transition-all shadow-xs tap-bounce"
                >
                  {formatRupiah(amt)}
                </button>
              ))}
            </div>

          </div>
        </div>

        <button
          type="submit"
          disabled={!canRetail || !selectedCustomerData || !activePackage || isSubmitting}
          className={`w-full text-white font-black text-sm py-2.5 rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95 ${
            selectedCustomerData && activePackage
              ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-blue-300 animate-pulse-glow hover:scale-[1.01]'
              : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
          }`}
        >
          <Printer size={16} /> {!canRetail ? 'Belum diberi hak proses pembayaran' : !selectedCustomerData ? 'Pilih Pelanggan Dulu' : (isSubmitting ? 'Menyamakan Nomor Invoice...' : 'Cetak Struk (58mm)')}
        </button>
      </form>
    </div>
  );
};

export default Transaksi;
