import React, { useState, useEffect } from 'react';
import { Wifi, Printer, Key, UserCheck, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import './Transaksi.css';

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

const Transaksi = ({ customers = [], packages = [], companyInfo, session, onComplete }) => {
  const defaultCashierName = session?.profile?.full_name || (session?.profile?.role === 'superadmin' ? 'Super Admin' : (companyInfo?.adminName || 'Admin Kasir'));
  const [selectedCust, setSelectedCust] = useState('');
  const [activePackage, setActivePackage] = useState(null);
  const [status, setStatus] = useState('LUNAS');
  const [amountPaid, setAmountPaid] = useState('');
  const [change, setChange] = useState(0);
  const [searchCust, setSearchCust] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomerData, setSelectedCustomerData] = useState(null);

  const filteredCustomers = customers
    .filter(c => {
      const term = searchCust.toLowerCase();
      const pppoe = (c.pppoe_id || c.pppoeId || '').toLowerCase();
      const custIdStr = (c.custid || c.customer_id || c.id || '').toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.nickname && c.nickname.toLowerCase().includes(term)) ||
        c.address.toLowerCase().includes(term) ||
        pppoe.includes(term) ||
        custIdStr.includes(term)
      );
    })
    // Diurutkan nama A-Z — memudahkan kasir menggulir mencari pelanggan saat lupa namanya
    // (kotak kosong menampilkan semua pelanggan, bukan cuma hasil ketikan).
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (selectedCust) {
      const cust = customers.find(c => c.id === selectedCust);
      if (cust) {
        setSelectedCustomerData(cust);
        const resolved = resolvePackageAndPrice(cust, packages);
        setActivePackage(resolved);
        setAmountPaid('');
      }
    } else {
      setSelectedCustomerData(null);
      setActivePackage(null);
      setAmountPaid('');
    }
  }, [selectedCust, customers, packages]);

  useEffect(() => {
    if (activePackage) {
      const payValue = Number(amountPaid) || 0;
      setChange(payValue > 0 ? payValue - activePackage.price : 0);
    } else {
      setChange(0);
    }
  }, [amountPaid, activePackage]);

  const handleQuickPay = (amount) => {
    setAmountPaid(amount.toString());
  };

  const handleUangPas = () => {
    if (activePackage) {
      setAmountPaid(activePackage.price.toString());
    }
  };

  const handleSelectCustomer = (cust) => {
    setSelectedCust(cust.id);
    setSelectedCustomerData(cust);
    const pppoe = cust.pppoe_id || cust.pppoeId;
    const custId = cust.custid || cust.customer_id || cust.id;
    setSearchCust(`${cust.name} - [ID: ${custId}]${pppoe ? ` (${pppoe})` : ''}`);
    
    // Set paket langsung dengan aturan harga Mbps yang akurat
    const resolved = resolvePackageAndPrice(cust, packages);
    setActivePackage(resolved);
    setAmountPaid('');
    setIsSearching(false);
  };

  const handleSubmit = (e) => {
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
    const custIdValue = targetCust.custid || targetCust.customer_id || targetCust.pppoe_id || targetCust.pppoeId || targetCust.id;
    
    const newTransaction = {
      id: `INV-${Date.now()}`,
      date: selectedDate.toISOString(),
      custid: custIdValue,
      customerId: custIdValue,
      customer_id: custIdValue,
      customerName: targetCust.name,
      pppoeId: targetCust.pppoe_id || targetCust.pppoeId || null,
      packageName: currentPkg.name,
      price: Number(currentPkg.price) || 0,
      status: status,
      paymentMethod: formData.get('paymentMethod') || 'Cash',
      amountPaid: Number(bayar) || Number(currentPkg.price) || 0,
      cashierName: formData.get('cashierName') || companyInfo?.adminName || 'Admin Utama',
      type: 'retail'
    };
    
    onComplete(newTransaction);
    e.target.reset();
    setSelectedCust('');
    setSelectedCustomerData(null);
    setSearchCust('');
    setAmountPaid('');
    setStatus('LUNAS');
  };

  return (
    <div className="transaksi-container p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white mb-6 shadow-xl shadow-blue-200">
        <h2 className="text-xl font-bold">Transaksi Pembayaran Retail</h2>
        <p className="text-blue-100 text-xs mt-1">Pilih pelanggan dari database / E-Billing Runsnet untuk memproses transaksi</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Status Toggle */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
           <button type="button" onClick={() => setStatus('LUNAS')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${status === 'LUNAS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>LUNAS</button>
           <button type="button" onClick={() => setStatus('KASBON')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${status === 'KASBON' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>KASBON</button>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          
          {/* Customer Selection Section (Mandatory Dropdown & Auto-complete) */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <UserCheck size={16} className="text-blue-600"/> Pilih Pelanggan
              </label>
              {selectedCustomerData && (
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12}/> Tersambung
                </span>
              )}
            </div>

            {/* Auto-complete Search Box */}
            <div className="relative">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ketik nama, atau klik untuk lihat semua pelanggan..."
                  value={searchCust}
                  onChange={(e) => {
                    setSearchCust(e.target.value);
                    setIsSearching(true);
                    if (!e.target.value) {
                      setSelectedCust('');
                      setSelectedCustomerData(null);
                    }
                  }}
                  onFocus={() => setIsSearching(true)}
                  onBlur={() => setTimeout(() => setIsSearching(false), 150)}
                  className={`w-full pl-10 pr-3.5 py-3.5 bg-gray-50 border rounded-xl outline-none text-xs font-medium transition-all ${selectedCustomerData ? 'border-emerald-500 bg-emerald-50/20 font-bold text-emerald-900' : 'border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                />
              </div>

              {isSearching && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                  {filteredCustomers.length > 0 ? filteredCustomers.map(c => {
                    const pppoe = c.pppoe_id || c.pppoeId;
                    const custId = c.custid || c.customer_id || c.id;
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => handleSelectCustomer(c)}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-200 space-y-2 animate-in fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Pelanggan Terpilih</span>
                    <h4 className="font-extrabold text-gray-900 text-sm">{selectedCustomerData.name}</h4>
                  </div>
                  <span className="bg-indigo-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm">
                    custid: {selectedCustomerData.custid || selectedCustomerData.customer_id || selectedCustomerData.pppoe_id || selectedCustomerData.id}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-blue-200/60">
                  <div>
                    <span className="text-gray-500 text-[10px] block">ID PPPoE:</span>
                    <span className="font-mono font-bold text-blue-700">{selectedCustomerData.pppoe_id || selectedCustomerData.pppoeId || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">Paket Internet:</span>
                    <span className="font-bold text-gray-800">{selectedCustomerData.package}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-amber-600" />
                <span>Kasir <strong>wajib memilih pelanggan</strong> dari pencarian di atas untuk menghindari kesalahan cocok data (no_match).</span>
              </div>
            )}
          </div>

          {activePackage && (
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase">Paket Berlangganan</p>
                  <p className="font-bold text-gray-800 text-sm">{activePackage.name}</p>
                </div>
                <Wifi size={20} className="text-blue-500 opacity-50"/>
              </div>

              {packages && packages.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ganti Pilihan Paket:</label>
                  <select
                    value={activePackage.name}
                    onChange={(e) => {
                      const sel = packages.find(p => p.name === e.target.value);
                      if (sel) {
                        setActivePackage({ name: sel.name, price: Number(sel.price) });
                        setAmountPaid(sel.price.toString());
                      }
                    }}
                    className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {packages.map(p => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} - {formatRupiah(p.price)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2.5 border-t border-blue-200/50 flex justify-between items-end">
                <span className="text-xs text-gray-500 font-semibold">Total Tagihan</span>
                <span className="text-xl font-black text-blue-700">{formatRupiah(activePackage.price)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tanggal Cetak</label>
              <input name="printDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama Penerima/Kasir</label>
              <input name="cashierName" type="text" defaultValue={defaultCashierName} placeholder="Nama Admin / Kasir" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-800" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Metode Pembayaran</label>
            <select name="paymentMethod" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm">
              <option value="Cash">Tunai (Cash)</option>
              <option value="Transfer Bank">Transfer Bank</option>
              <option value="QRIS">QRIS</option>
              <option value="CS">Bayar via CS</option>
            </select>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700">Jumlah Bayar (Rp)</label>
                <button 
                  type="button" 
                  onClick={handleUangPas} 
                  className="text-xs font-black bg-blue-600 text-white px-5 py-2 rounded-xl shadow-md shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
                >
                  UANG PAS
                </button>
              </div>
              <input 
                name="amountPaid" 
                type="number" 
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0" 
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-2xl font-black text-blue-600 placeholder:text-gray-300" 
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[50000, 100000, 200000].map((amt) => (
                <button 
                  key={amt} 
                  type="button" 
                  onClick={() => handleQuickPay(amt)}
                  className="py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-gray-600 active:bg-blue-600 active:text-white transition-all shadow-sm"
                >
                  {formatRupiah(amt)}
                </button>
              ))}
            </div>

            {/* Change Result */}
            {amountPaid && (
              <div className={`p-4 rounded-2xl flex justify-between items-center animate-in zoom-in duration-200 ${change >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <span className="text-xs font-bold text-gray-500 uppercase">{change >= 0 ? 'Kembalian' : 'Kurang'}</span>
                <span className={`text-lg font-black ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatRupiah(Math.abs(change))}
                </span>
              </div>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={!selectedCustomerData || !activePackage} 
          className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl mt-4 shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Printer size={20} /> {!selectedCustomerData ? 'Pilih Pelanggan Dulu' : 'Cetak Struk (58mm)'}
        </button>
      </form>
    </div>
  );
};

export default Transaksi;
