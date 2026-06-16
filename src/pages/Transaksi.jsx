import React, { useState, useEffect } from 'react';
import { Wifi, Printer } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import './Transaksi.css';

const Transaksi = ({ customers, packages, companyInfo, onComplete }) => {
  const [selectedCust, setSelectedCust] = useState('');
  const [activePackage, setActivePackage] = useState(null);
  const [status, setStatus] = useState('LUNAS');
  const [amountPaid, setAmountPaid] = useState('');
  const [change, setChange] = useState(0);
  const [searchCust, setSearchCust] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchCust.toLowerCase()) || 
    (c.nickname && c.nickname.toLowerCase().includes(searchCust.toLowerCase())) ||
    c.address.toLowerCase().includes(searchCust.toLowerCase())
  );
  
  useEffect(() => {
    if(selectedCust) {
      const cust = customers.find(c => c.id === selectedCust);
      if(cust) {
        const pkg = packages.find(p => p.name === cust.package);
        if(pkg) {
          setActivePackage(pkg);
          // Auto fill bayar jika tunai
          setAmountPaid(''); 
        }
      }
    } else {
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
    setSearchCust(`${cust.name}${cust.nickname ? ` (${cust.nickname})` : ''}`);
    setIsSearching(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if(!activePackage) return;
    
    const bayar = Number(amountPaid) || activePackage.price;
    
    const selectedDate = formData.get('printDate') ? new Date(formData.get('printDate')) : new Date();
    // Jika tanggal dipilih manual, pastikan jamnya menggunakan jam saat ini (real-time)
    // Agar tidak default ke 00:00 UTC (07:00 WIB)
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    const targetCust = customers.find(c => c.id === selectedCust);
    
    const newTransaction = {
      id: `INV-${Date.now()}`,
      date: selectedDate.toISOString(),
      customerName: targetCust?.name || 'Pelanggan Umum',
      packageName: activePackage.name,
      price: activePackage.price,
      status: status,
      paymentMethod: formData.get('paymentMethod'),
      amountPaid: bayar,
      cashierName: formData.get('cashierName') || 'Admin Utama',
      type: 'retail'
    };
    
    onComplete(newTransaction);
    e.target.reset();
    setSelectedCust('');
    setSearchCust('');
    setAmountPaid('');
    setStatus('LUNAS');
  };

  return (
    <div className="transaksi-container p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white mb-6 shadow-xl shadow-blue-200">
        <h2 className="text-xl font-bold">Transaksi Baru</h2>
        <p className="text-blue-100 text-xs mt-1">Buat tagihan untuk pelanggan retail</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
           <button type="button" onClick={() => setStatus('LUNAS')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${status === 'LUNAS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>LUNAS</button>
           <button type="button" onClick={() => setStatus('KASBON')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${status === 'KASBON' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>KASBON</button>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Pelanggan</label>
            <div className="relative">
              <input 
                type="text" 
                required
                placeholder="Ketik nama atau nama panggilan..." 
                value={searchCust}
                onChange={(e) => {
                  setSearchCust(e.target.value);
                  setIsSearching(true);
                  if(!e.target.value) setSelectedCust('');
                }}
                onFocus={() => setIsSearching(true)}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
              />
              {isSearching && searchCust.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                  {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => handleSelectCustomer(c)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <p className="font-bold text-sm text-gray-800">{c.name} {c.nickname && <span className="text-blue-600 font-medium text-[11px]">({c.nickname})</span>}</p>
                      <p className="text-[10px] text-gray-500">{c.address}</p>
                    </div>
                  )) : (
                    <div className="p-4 text-center text-xs text-gray-400 italic">Pelanggan tidak ditemukan...</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {activePackage && (
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase">Paket Berlangganan</p>
                  <p className="font-bold text-gray-800">{activePackage.name}</p>
                </div>
                <Wifi size={20} className="text-blue-500 opacity-50"/>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200/50 flex justify-between items-end">
                <span className="text-xs text-gray-500">Total Tagihan</span>
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
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama Penerima/Admin</label>
              <input name="cashierName" type="text" defaultValue={companyInfo.adminName || ''} placeholder="Nama Admin" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
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

        <button type="submit" disabled={!activePackage} className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl mt-4 shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2">
          <Printer size={20} /> Cetak Struk (58mm)
        </button>
      </form>
    </div>
  );
};

export default Transaksi;
