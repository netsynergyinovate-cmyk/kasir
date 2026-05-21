import React, { useState, useEffect } from 'react';
import { 
  Wifi, Users, FileText, Home, PlusCircle, Printer, 
  Search, CheckCircle, X, DollarSign, Calendar,
  Settings as SettingsIcon, Trash2, Save, Clock, History,
  Menu, Building2, CreditCard, ChevronRight, Upload, AlertCircle
} from 'lucide-react';

const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(angka);
};

const formatDate = (isoString) => {
  const date = new Date(isoString);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${dayName}, ${day} ${monthName} ${year} ${hours}:${minutes}:${seconds}`;
};

const INIT_CUSTOMERS = [
  { id: 'CUST-001', name: 'Budi Santoso', address: 'Jl. Merdeka No.10', package: 'Paket RT RW 10Mbps', status: 'aktif', dueDate: 15 },
  { id: 'CUST-002', name: 'Siti Aminah', address: 'Perum Asri Blok B2', package: 'Paket RT RW 20Mbps', status: 'isolir', dueDate: 5 },
  { id: 'CUST-003', name: 'Warung Kopi Berkah', address: 'Jl. Sudirman 45', package: 'Paket Pro 50Mbps', status: 'aktif', dueDate: 1 },
];

const INIT_TRANSACTIONS = [
  { id: 'INV-171542123', date: new Date().toISOString(), customerName: 'Budi Santoso', packageName: 'Paket RT RW 10Mbps', price: 150000, status: 'LUNAS', paymentMethod: 'Transfer' },
];

const INTERNET_PACKAGES = [
  { id: 1, name: 'Paket RT RW 10Mbps', price: 150000 },
  { id: 2, name: 'Paket RT RW 20Mbps', price: 250000 },
  { id: 3, name: 'Paket Pro 50Mbps', price: 400000 },
];

const INIT_COMPANY = {
  name: 'PT Net Synergy Inovate',
  address: 'Jl. Teknologi Canggih No. 99, Jakarta',
  phone: '0812-3456-7890',
  logo: null
};

const AddCustomerModal = ({ show, packages, onClose, onAdd }) => {
  if(!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedPkg = packages.find(p => p.name === formData.get('package'));
    
    const newCustomer = {
      id: `CUST-00${Math.floor(Math.random() * 1000)}`,
      name: formData.get('name'),
      address: formData.get('address'),
      package: formData.get('package'),
      status: 'aktif',
      dueDate: parseInt(formData.get('dueDate'))
    };
    onAdd(newCustomer);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Tambah Pelanggan</h3>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-full"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input name="name" required type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="Nama Pelanggan"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Pemasangan</label>
            <input name="address" required type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="Blok / No Rumah"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Paket</label>
            <select name="package" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm">
              <option value="">-- Pilih Paket Internet --</option>
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.name}>{pkg.name} - {formatRupiah(pkg.price)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Jatuh Tempo</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 pr-3 focus-within:ring-2 focus-within:ring-blue-500">
               <div className="bg-white p-2 rounded-lg shadow-sm text-gray-500"><Calendar size={18}/></div>
               <input name="dueDate" required type="number" min="1" max="31" className="w-full bg-transparent outline-none text-sm p-1" placeholder="Tgl (1-31)"/>
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl mt-4 hover:bg-blue-700 shadow-md">
            Simpan Pelanggan
          </button>
        </form>
      </div>
    </div>
  );
};

const TransactionForm = ({ customers, packages, onComplete }) => {
  const [selectedCust, setSelectedCust] = useState('');
  const [activePackage, setActivePackage] = useState(null);
  const [status, setStatus] = useState('LUNAS');
  
  useEffect(() => {
    if(selectedCust) {
      const cust = customers.find(c => c.id === selectedCust);
      if(cust) {
        const pkg = packages.find(p => p.name === cust.package);
        if(pkg) setActivePackage(pkg);
      }
    } else {
      setActivePackage(null);
    }
  }, [selectedCust, customers, packages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if(!activePackage) return;
    
    const newTransaction = {
      id: `INV-${Date.now()}`,
      date: new Date().toISOString(),
      customerName: customers.find(c => c.id === selectedCust)?.name || 'Pelanggan Umum',
      packageName: activePackage.name,
      price: activePackage.price,
      status: status,
      paymentMethod: formData.get('paymentMethod'),
      type: 'retail'
    };
    
    onComplete(newTransaction);
    e.target.reset();
    setSelectedCust('');
    setStatus('LUNAS');
  };

  return (
    <div className="p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white mb-6 shadow-xl shadow-blue-200">
        <h2 className="text-xl font-bold">Transaksi Baru</h2>
        <p className="text-blue-100 text-xs mt-1">Buat tagihan untuk pelanggan retail</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle LUNAS / KASBON */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
           <button type="button" onClick={() => setStatus('LUNAS')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${status === 'LUNAS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>LUNAS</button>
           <button type="button" onClick={() => setStatus('KASBON')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${status === 'KASBON' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>KASBON</button>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Pelanggan</label>
            <select required value={selectedCust} onChange={(e) => setSelectedCust(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium">
              <option value="">-- Cari Nama Pelanggan --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
              ))}
            </select>
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
              <p className="text-[10px] text-right text-gray-400 mt-1">*Sudah termasuk PPN 11%</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Metode Pembayaran</label>
            <select name="paymentMethod" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm">
              <option value="Cash">Tunai (Cash)</option>
              <option value="Transfer Bank">Transfer Bank</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={!activePackage} className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl mt-4 shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2">
          <Printer size={20} /> Cetak Struk (58mm)
        </button>
      </form>
    </div>
  );
};

const SettingsView = ({ packages, setPackages, companyInfo, setCompanyInfo }) => {
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyInfo(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPackage = () => {
    if(newPkgName && newPkgPrice) {
      setPackages([...packages, { id: Date.now(), name: newPkgName, price: Number(newPkgPrice) }]);
      setNewPkgName('');
      setNewPkgPrice('');
    }
  };

  const handleDeletePackage = (id) => {
    setPackages(packages.filter(p => p.id !== id));
  };

  return (
    <div className="p-4 pb-32 space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-3"><Building2 size={18} className="text-blue-500"/> Profil Perusahaan</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Upload Logo</label>
            <div className="flex items-center gap-3">
              {companyInfo.logo ? (
                 <img src={companyInfo.logo} alt="Logo" className="w-12 h-12 rounded-xl object-contain border" />
              ) : (
                 <div className="w-12 h-12 bg-gray-100 rounded-xl border flex items-center justify-center"><Building2 size={20} className="text-gray-400"/></div>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nama Usaha / Toko</label>
            <input name="name" value={companyInfo.name} onChange={handleCompanyChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Alamat</label>
            <textarea name="address" value={companyInfo.address} onChange={handleCompanyChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" rows="2"></textarea>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">No. Telepon / WA</label>
            <input name="phone" value={companyInfo.phone} onChange={handleCompanyChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"/>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-3"><Wifi size={18} className="text-blue-500"/> Manajemen Paket Internet</h3>
        
        <div className="space-y-3 mb-5">
          {packages.map(pkg => (
            <div key={pkg.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="font-bold text-sm text-gray-800">{pkg.name}</p>
                <p className="text-xs text-blue-600 font-medium">{formatRupiah(pkg.price)}</p>
              </div>
              <button onClick={() => handleDeletePackage(pkg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
           <h4 className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wider">Tambah Paket Baru</h4>
           <div className="space-y-3">
             <input value={newPkgName} onChange={(e)=>setNewPkgName(e.target.value)} type="text" placeholder="Nama Paket (Misal: 100Mbps)" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm"/>
             <input value={newPkgPrice} onChange={(e)=>setNewPkgPrice(e.target.value)} type="number" placeholder="Harga (Misal: 300000)" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm"/>
             <button onClick={handleAddPackage} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700">Simpan Paket</button>
           </div>
        </div>
      </div>
    </div>
  );
};

const InstansiInvoiceView = ({ onComplete }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const instansiTrx = {
      id: `INV-B2B-${Date.now()}`,
      date: new Date().toISOString(),
      instansiName: formData.get('instansiName'),
      address: formData.get('address'),
      serviceName: formData.get('serviceName'),
      price: Number(formData.get('price')),
      type: 'instansi'
    };
    onComplete(instansiTrx);
    e.target.reset();
  };

  return (
    <div className="p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-3xl p-6 text-white mb-6 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Invoice Instansi</h2>
          <p className="text-gray-300 text-xs mt-1">Cetak Tagihan Format A4 (B2B)</p>
        </div>
        <Building2 size={40} className="text-gray-600 opacity-50" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Instansi / Perusahaan</label>
          <input name="instansiName" required type="text" placeholder="Misal: Dinas Pendidikan..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Instansi</label>
          <textarea name="address" required rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Layanan & Periode</label>
          <input name="serviceName" required type="text" placeholder="Misal: Dedicated Internet 100Mbps - Bulan Mei" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Tagihan (Rp)</label>
          <input name="price" required type="number" placeholder="Misal: 1500000" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm" />
        </div>

        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-gray-200 hover:bg-black transition-colors flex items-center justify-center gap-2">
          <FileText size={18} /> Terbitkan Invoice A4
        </button>
      </form>
    </div>
  );
};

const ThermalReceipt = ({ transaction, companyInfo, onClose, onPrint }) => {
  if (!transaction || transaction.type === 'instansi') return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex p-4 overflow-y-auto print:bg-white print:p-0">
      
      {/* Container Kertas (Maksimal 58mm saat diprint) */}
      <div className="print-container bg-white w-full max-w-[320px] mx-auto m-auto relative flex flex-col font-mono text-black print:m-0 print:w-[58mm] print:shadow-none shadow-2xl rounded-sm">
        
        {/* Ornamen sobekan kertas (Hanya tampil di layar) */}
        <div className="h-4 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDAgNSwxMCAxMCwwIiBmaWxsPSIjZTElZTElZTEiLz48L3N2Zz4=')] bg-repeat-x print:hidden absolute -top-4 left-0"></div>

        <div className="p-4 print:p-0">
          {/* Header Toko */}
          <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-4">
            {companyInfo.logo && (
              <img src={companyInfo.logo} alt="Logo" className="w-12 h-12 object-contain mx-auto mb-2 grayscale" />
            )}
            <h1 className="font-bold text-xl uppercase tracking-tighter leading-none">{companyInfo.name}</h1>
            <p className="text-[11px] leading-tight mt-1">{companyInfo.address}</p>
            <p className="text-[11px] mt-1">Telp: {companyInfo.phone}</p>
          </div>
          
          {/* Info Waktu dan Kasir */}
          <div className="text-[11px] mb-4">
            <div className="flex justify-between mb-1">
              <span>Waktu:</span>
              <span className="text-right">{formatDate(transaction.date)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Kasir:</span>
              <span>Admin Utama</span>
            </div>
            <div className="flex justify-between">
              <span>No.INV:</span>
              <span className="font-bold">{transaction.id}</span>
            </div>
          </div>

          {/* STATUS LUNAS/KASBON BOLD */}
          <div className={`text-center py-1.5 mb-4 border-y-2 border-black ${transaction.status === 'LUNAS' ? 'text-black' : 'text-black'}`}>
            <h2 className="text-xl font-black tracking-widest uppercase">{transaction.status}</h2>
          </div>

          {/* Item Transaksi */}
          <div className="border-b-2 border-dashed border-gray-400 pb-3 mb-3">
             <p className="font-bold text-sm uppercase">{transaction.customerName}</p>
             <div className="flex justify-between text-xs mt-1">
               <span>{transaction.packageName}</span>
             </div>
          </div>

          {/* Total & Pembayaran */}
          <div className="text-sm mb-4">
             <div className="flex justify-between font-bold text-base mb-1">
               <span>TOTAL</span>
               <span>{formatRupiah(transaction.price)}</span>
             </div>
             <p className="text-[9px] text-center w-full mt-1">*Sudah termasuk PPN 11%</p>
             <div className="flex justify-between text-xs mt-2 pt-2 border-t border-dotted border-gray-300">
               <span>Bayar ({transaction.paymentMethod})</span>
               <span>{formatRupiah(transaction.price)}</span>
             </div>
             <div className="flex justify-between text-xs mt-1">
               <span>Kembali</span>
               <span>Rp 0</span>
             </div>
          </div>

          {/* Footer & Barcode Simulasi */}
          <div className="text-center text-[10px] mt-6">
            <p>Terima kasih atas kepercayaannya</p>
            <p>Layanan Pengaduan WA: {companyInfo.phone}</p>
            <div className="mt-4 flex flex-col items-center">
              {/* Simulasi Barcode Geometris */}
              <svg width="180" height="40" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="0" width="3" height="40" fill="black" />
                <rect x="16" y="0" width="1" height="40" fill="black" />
                <rect x="20" y="0" width="4" height="40" fill="black" />
                <rect x="28" y="0" width="2" height="40" fill="black" />
                <rect x="34" y="0" width="6" height="40" fill="black" />
                <rect x="42" y="0" width="1" height="40" fill="black" />
                <rect x="46" y="0" width="8" height="40" fill="black" />
                <rect x="58" y="0" width="2" height="40" fill="black" />
                <rect x="64" y="0" width="3" height="40" fill="black" />
                <rect x="70" y="0" width="1" height="40" fill="black" />
                <rect x="74" y="0" width="6" height="40" fill="black" />
                <rect x="82" y="0" width="2" height="40" fill="black" />
                <rect x="88" y="0" width="4" height="40" fill="black" />
                <rect x="96" y="0" width="1" height="40" fill="black" />
                <rect x="100" y="0" width="5" height="40" fill="black" />
                <rect x="108" y="0" width="2" height="40" fill="black" />
                <rect x="114" y="0" width="8" height="40" fill="black" />
                <rect x="126" y="0" width="1" height="40" fill="black" />
                <rect x="130" y="0" width="3" height="40" fill="black" />
                <rect x="136" y="0" width="4" height="40" fill="black" />
                <rect x="144" y="0" width="2" height="40" fill="black" />
                <rect x="150" y="0" width="6" height="40" fill="black" />
                <rect x="160" y="0" width="1" height="40" fill="black" />
                <rect x="164" y="0" width="4" height="40" fill="black" />
              </svg>
              <p className="mt-1 tracking-widest">{transaction.id}</p>
            </div>
            <p className="mt-4 text-gray-400 print:hidden text-[8px]">Thermal Print Preview 58mm</p>
          </div>
        </div>

        {/* Tombol Aksi Layar */}
        <div className="absolute top-4 right-4 flex gap-2 print:hidden">
           <button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg">
              <X size={20} />
           </button>
           <button onClick={onPrint} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold">
              <Printer size={20} /> Cetak
           </button>
        </div>
      </div>
    </div>
  );
};

const A4InstansiReceipt = ({ transaction, companyInfo, onClose, onPrint }) => {
  if (!transaction || transaction.type !== 'instansi') return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="print-a4-container bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto m-auto shadow-2xl p-8 sm:p-12 relative flex flex-col print:shadow-none print:m-0 print:p-8">
        
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
          <div className="flex items-center gap-4">
             {companyInfo?.logo ? (
                 <img src={companyInfo.logo} alt="Logo" className="w-20 h-20 object-contain" />
              ) : (
                <div className="w-20 h-20 bg-blue-600 flex items-center justify-center text-white font-bold text-xl rounded">LOGO</div>
              )}
              <div>
                <h1 className="text-2xl font-black uppercase text-gray-900 tracking-wider">{companyInfo.name}</h1>
                <p className="text-sm text-gray-600 mt-1">{companyInfo.address}</p>
                <p className="text-sm text-gray-600">Telp: {companyInfo.phone}</p>
              </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-blue-600 tracking-tighter uppercase">INVOICE</h2>
            <p className="font-bold text-gray-700 mt-2">NO: <span className="font-mono font-normal">{transaction.id}</span></p>
            <p className="font-bold text-gray-700">TANGGAL: <span className="font-normal">{formatDate(transaction.date)}</span></p>
          </div>
        </div>

        <div className="mb-8 p-5 bg-gray-50 border border-gray-200 rounded-lg w-2/3">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">TAGIHAN KEPADA:</p>
          <h3 className="text-xl font-bold text-gray-900">{transaction.instansiName}</h3>
          <p className="text-gray-700 mt-1">{transaction.address}</p>
        </div>

        <div className="min-h-[200px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="py-3 px-4 font-bold uppercase text-sm w-16 text-center">No</th>
                <th className="py-3 px-4 font-bold uppercase text-sm">Deskripsi Layanan</th>
                <th className="py-3 px-4 font-bold uppercase text-sm text-right w-48">Total Biaya</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-4 px-4 text-center font-bold text-gray-600">1</td>
                <td className="py-4 px-4 font-medium text-gray-800">{transaction.serviceName}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900">{formatRupiah(transaction.price)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-1/2">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="font-bold text-gray-600">Subtotal</span>
              <span className="font-bold">{formatRupiah(transaction.price)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 text-sm text-gray-500">
              <span>PPN (11%)</span>
              <span>Termasuk</span>
            </div>
            <div className="flex justify-between py-3 bg-blue-50 px-4 mt-2 rounded-lg">
              <span className="font-black text-lg text-blue-900">GRAND TOTAL</span>
              <span className="font-black text-lg text-blue-900">{formatRupiah(transaction.price)}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 flex justify-between items-end flex-1">
          <div>
             <p className="font-bold text-sm text-gray-500 uppercase tracking-wide">Info Pembayaran Transfer:</p>
             <p className="font-bold mt-1">Bank BCA - 1234567890</p>
             <p className="text-sm">a/n {companyInfo.name}</p>
          </div>
          <div className="text-center w-48">
            <p className="mb-16 text-sm text-gray-600">Hormat Kami,</p>
            <div className="border-b border-gray-400 w-full mb-1"></div>
            <p className="font-bold text-sm">Finance / Admin</p>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex gap-2 print:hidden">
           <button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg transition-colors">
              <X size={20} />
           </button>
           <button onClick={onPrint} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold transition-colors">
              <Printer size={20} /> Cetak PDF / A4
           </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [customers, setCustomers] = useState(INIT_CUSTOMERS);
  const [transactions, setTransactions] = useState(INIT_TRANSACTIONS);
  const [packages, setPackages] = useState(INTERNET_PACKAGES);
  const [companyInfo, setCompanyInfo] = useState(INIT_COMPANY);
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [receiptToView, setReceiptToView] = useState(null);
  const [instansiReceiptToView, setInstansiReceiptToView] = useState(null);

  const handleTransactionComplete = (newTrx) => {
    setTransactions([newTrx, ...transactions]);
    setReceiptToView(newTrx);
  };

  const handleInstansiComplete = (newTrx) => {
    setTransactions([newTrx, ...transactions]);
    setInstansiReceiptToView(newTrx);
  };

  const handleAddCustomer = (newCust) => {
    setCustomers([newCust, ...customers]);
    setShowAddCustomer(false);
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const style = document.createElement('style');
    if (instansiReceiptToView) {
       style.innerHTML = `
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
          body > div { display: none !important; }
          .print-a4-container { display: block !important; }
        }
      `;
    } else {
      style.innerHTML = `
        @media print {
          @page { margin: 0; size: 58mm auto; }
          body { margin: 0; padding: 0; background: white; }
          body > div { display: none !important; }
          .print-container { display: block !important; }
        }
      `;
    }
    document.head.appendChild(style);
    return () => { if(document.head.contains(style)) document.head.removeChild(style); }
  }, [instansiReceiptToView, receiptToView]);

  const renderDashboard = () => (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-3xl text-white shadow-lg shadow-blue-200">
          <p className="text-xs font-medium text-blue-100 opacity-90 mb-1">Pendapatan Hari Ini</p>
          <p className="text-xl font-bold tracking-tight">
            {formatRupiah(transactions.reduce((acc, curr) => acc + curr.price, 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Pelanggan</p>
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <p className="text-xl font-bold text-gray-800">{customers.length}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between items-end mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Transaksi Terakhir</h2>
          <button onClick={() => setActiveTab('history')} className="text-xs text-blue-600 font-bold hover:underline">Lihat Semua</button>
        </div>
        <div className="space-y-3">
          {transactions.slice(0, 3).map((trx) => (
            <div key={trx.id} onClick={() => trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx)} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trx.type === 'instansi' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600'}`}>
                  {trx.type === 'instansi' ? <Building2 size={18}/> : <FileText size={18} />}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm leading-tight">{trx.type === 'instansi' ? trx.instansiName : trx.customerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-500">{new Date(trx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                    {trx.type !== 'instansi' && (
                       <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${trx.status === 'LUNAS' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                         {trx.status}
                       </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="font-bold text-sm text-gray-900">{formatRupiah(trx.price)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Riwayat Transaksi</h2>
      </div>
      <div className="bg-white flex items-center p-2 rounded-2xl border border-gray-200 shadow-sm">
        <Search size={20} className="text-gray-400 ml-2" />
        <input type="text" placeholder="Cari ID Invoice atau Nama..." className="bg-transparent border-none outline-none p-2 w-full text-sm" />
      </div>
      <div className="space-y-3 mt-4">
        {transactions.map((trx) => (
          <div key={trx.id} onClick={() => trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-gray-500">{trx.id}</span>
              {trx.type !== 'instansi' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trx.status === 'LUNAS' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {trx.status}
                </span>
              )}
            </div>
            <p className="font-bold text-gray-800 text-base">{trx.type === 'instansi' ? trx.instansiName : trx.customerName}</p>
            <p className="text-xs text-gray-500 mt-1">{trx.type === 'instansi' ? trx.serviceName : trx.packageName}</p>
            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-400">{new Date(trx.date).toLocaleDateString('id-ID')}</span>
              <span className="font-black text-blue-600">{formatRupiah(trx.price)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Data Pelanggan</h2>
        <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200">
          <PlusCircle size={16} /> Tambah
        </button>
      </div>
      <div className="bg-white flex items-center p-2 rounded-2xl border border-gray-200 shadow-sm">
        <Search size={20} className="text-gray-400 ml-2" />
        <input type="text" placeholder="Cari nama pelanggan..." className="bg-transparent border-none outline-none p-2 w-full text-sm" />
      </div>
      <div className="space-y-3 mt-4">
        {customers.map((cust) => (
          <div key={cust.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gray-50 px-3 py-1.5 rounded-bl-xl border-b border-l border-gray-100">
               <p className="text-[10px] font-bold text-gray-500">Jatuh Tempo: <span className="text-red-500">Tgl {cust.dueDate}</span></p>
            </div>
            <div className="flex items-start gap-3 mt-2">
              <div className="relative">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                  {cust.name.charAt(0)}
                </div>
                {/* Indikator Status Aktif/Isolir */}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <div className="flex-1 pr-16">
                <p className="font-bold text-gray-800 leading-tight">{cust.name}</p>
                <p className="text-xs font-medium text-blue-600 mt-0.5">{cust.package}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100 flex items-start gap-1.5">
              <Wifi size={14} className="mt-0.5 text-blue-500 shrink-0" /> 
              <span className="leading-tight">{cust.address}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-200 font-sans ${receiptToView || instansiReceiptToView ? 'print-container' : ''}`}>
      
      <div className="max-w-md mx-auto h-screen bg-gray-50 shadow-2xl relative overflow-hidden flex flex-col print:hidden">
        
        {/* HEADER */}
        <header className="bg-white px-4 py-3.5 border-b border-gray-100 sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-1 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
            <Menu size={22} />
          </button>

          {companyInfo.logo ? (
            <img src={companyInfo.logo} alt="Logo" className="w-9 h-9 rounded-xl object-contain shadow-sm border border-gray-100 shrink-0 bg-white p-0.5" />
          ) : (
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-200 shrink-0">
              <Building2 size={18} />
            </div>
          )}
          <div className="overflow-hidden">
            <h1 className="font-bold text-gray-900 text-[15px] leading-tight truncate">{companyInfo.name}</h1>
            <p className="text-[11px] text-gray-500 font-medium">ISP Billing POS</p>
          </div>
        </header>

        {/* SIDEBAR */}
        <div 
          className={`fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 print:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
        
        <div className={`fixed top-0 left-0 h-full w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out shadow-2xl print:hidden flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="p-6 bg-gradient-to-br from-blue-700 to-blue-900 text-white flex flex-col items-start gap-4">
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
                <X size={18} />
              </button>
              {companyInfo.logo ? (
                 <img src={companyInfo.logo} alt="Logo" className="w-16 h-16 rounded-2xl object-contain bg-white p-1" />
              ) : (
                 <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center"><Building2 size={30}/></div>
              )}
              <div>
                <h2 className="font-bold text-lg leading-tight">{companyInfo.name}</h2>
                <p className="text-xs text-blue-200 mt-1">Admin Panel</p>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-2">Menu Utama</div>
              <button onClick={() => {setActiveTab('dashboard'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${activeTab==='dashboard' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Home size={20} className={activeTab==='dashboard' ? 'text-blue-600' : 'text-gray-400'}/> Beranda
              </button>
              <button onClick={() => {setActiveTab('customers'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${activeTab==='customers' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Users size={20} className={activeTab==='customers' ? 'text-blue-600' : 'text-gray-400'}/> Pelanggan Retail
              </button>
              <button onClick={() => {setActiveTab('pos'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${activeTab==='pos' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Printer size={20} className={activeTab==='pos' ? 'text-blue-600' : 'text-gray-400'}/> Kasir (58mm)
              </button>
              <button onClick={() => {setActiveTab('settings'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${activeTab==='settings' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <SettingsIcon size={20} className={activeTab==='settings' ? 'text-blue-600' : 'text-gray-400'}/> Pengaturan
              </button>

              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-6">Korporat / B2B</div>
              <button onClick={() => {setActiveTab('instansi'); setIsSidebarOpen(false);}} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition border-2 ${activeTab==='instansi' ? 'border-gray-900 bg-gray-900 text-white font-bold' : 'border-transparent text-gray-800 hover:bg-gray-100 font-medium'}`}>
                <div className="flex items-center gap-3">
                   <Building2 size={20} className={activeTab==='instansi' ? 'text-blue-400' : 'text-gray-500'}/> Invoice Instansi
                </div>
                <ChevronRight size={16} className="opacity-50" />
              </button>
           </div>
        </div>

        {/* KONTEN UTAMA */}
        <main className="flex-1 overflow-y-auto relative">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'customers' && renderCustomers()}
          {activeTab === 'settings' && (
            <SettingsView 
              packages={packages} 
              setPackages={setPackages}
              companyInfo={companyInfo}
              setCompanyInfo={setCompanyInfo}
            />
          )}
          {activeTab === 'pos' && (
            <TransactionForm 
              customers={customers} 
              packages={packages}
              onComplete={handleTransactionComplete} 
            />
          )}
          {activeTab === 'instansi' && (
             <InstansiInvoiceView onComplete={handleInstansiComplete} />
          )}
        </main>

        {/* BOTTOM NAVIGATION PRESISI SIMETRIS */}
        <nav className="bg-white border-t border-gray-200 h-[72px] flex justify-between items-center px-2 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.03)] shrink-0 relative">
          <div className="flex w-full justify-between items-center relative">
            
            {/* Kiri - 2 Menu */}
            <div className="flex justify-around w-[40%]">
              <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}>
                <Home size={22} className={activeTab === 'dashboard' ? 'fill-blue-50' : ''} />
                <span className="text-[9px] font-bold">Beranda</span>
              </button>
              <button onClick={() => setActiveTab('customers')} className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'customers' ? 'text-blue-600' : 'text-gray-400'}`}>
                <Users size={22} className={activeTab === 'customers' ? 'fill-blue-50' : ''} />
                <span className="text-[9px] font-bold">Pelanggan</span>
              </button>
            </div>

            {/* Spacer Tengah untuk memberi ruang tombol melayang */}
            <div className="w-[20%]"></div>

            {/* Kanan - 2 Menu */}
            <div className="flex justify-around w-[40%]">
               <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`}>
                <History size={22} className={activeTab === 'history' ? 'fill-blue-50' : ''} />
                <span className="text-[9px] font-bold">Riwayat</span>
              </button>
              <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`}>
                <SettingsIcon size={22} className={activeTab === 'settings' ? 'fill-blue-50' : ''} />
                <span className="text-[9px] font-bold">Setting</span>
              </button>
            </div>
            
            {/* Tombol Tengah (Floating Button) Presisi di Tengah (Absolute) */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center justify-center z-30">
              <button 
                onClick={() => setActiveTab('pos')} 
                className="w-[60px] h-[60px] bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(37,99,235,0.4)] border-4 border-gray-50 active:scale-95 transition-transform mb-1"
              >
                <PlusCircle size={28} />
              </button>
              <span className="text-[10px] font-black tracking-tight text-gray-700 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-sm border border-gray-100 whitespace-nowrap">
                Transaksi Baru
              </span>
            </div>

          </div>
        </nav>
      </div>

      {/* Modals & Print Views */}
      <AddCustomerModal 
        show={showAddCustomer} 
        packages={packages}
        onClose={() => setShowAddCustomer(false)} 
        onAdd={handleAddCustomer} 
      />
      
      <ThermalReceipt 
        transaction={receiptToView} 
        companyInfo={companyInfo}
        onClose={() => setReceiptToView(null)} 
        onPrint={handlePrint} 
      />

      <A4InstansiReceipt
        transaction={instansiReceiptToView}
        companyInfo={companyInfo}
        onClose={() => setInstansiReceiptToView(null)}
        onPrint={handlePrint}
      />
    </div>
  );
}