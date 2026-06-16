import React, { useState, useEffect } from 'react';
import { 
  Building2, Wifi, Trash2, Bluetooth, BluetoothConnected, 
  BluetoothOff, AlertCircle, Printer, User, LogOut, Image, ChevronRight 
} from 'lucide-react';
import { formatRupiah } from '../utils/format';

const Settings = ({ 
  packages, onAddPackage, onDeletePackage, companyInfo, setCompanyInfo, 
  btDevice, isConnecting, connectBluetooth, disconnectBluetooth, reconnectBluetooth, savedDeviceName,
  deferredPrompt, onInstall
}) => {
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [localCompany, setLocalCompany] = useState(companyInfo);

  // Sync local state when companyInfo prop changes (e.g., after initial fetch)
  useEffect(() => {
    setLocalCompany(companyInfo);
  }, [companyInfo]);

  const handleLocalChange = (e) => {
    const { name, value } = e.target;
    setLocalCompany({ ...localCompany, [name]: value });
  };

  const handleBlur = () => {
    // Only update if there's a difference
    if (JSON.stringify(localCompany) !== JSON.stringify(companyInfo)) {
      setCompanyInfo(localCompany);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = { ...localCompany, logo: reader.result };
        setLocalCompany(updated);
        setCompanyInfo(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPkg = () => {
    if(newPkgName && newPkgPrice) {
      onAddPackage(newPkgName, newPkgPrice);
      setNewPkgName('');
      setNewPkgPrice('');
    }
  };

  const isConnected = btDevice && btDevice.gatt.connected;

  return (
    <div className="pb-32 bg-gray-50 min-h-screen animate-in fade-in duration-300">
      {/* New Gradient Header */}
      <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-b-[2rem] shadow-lg mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
            <Building2 size={32} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Pengaturan Sistem</h1>
            <p className="text-blue-100 text-xs font-medium">Konfigurasi operasional KAsir</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Section: Profil Admin */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Profil Admin</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <User size={24} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Nama Admin</label>
                <input 
                  name="adminName" 
                  value={localCompany.adminName || ''} 
                  onChange={handleLocalChange} 
                  onBlur={handleBlur} 
                  type="text" 
                  placeholder="Nama Admin"
                  className="font-bold text-gray-800 bg-transparent border-none p-0 w-full outline-none text-base"
                />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Fee per Transaksi</p>
                <div className="flex items-center gap-1">
                  <span className="font-black text-emerald-600">Rp</span>
                  <input 
                    name="adminFee" 
                    value={localCompany.adminFee || ''} 
                    onChange={handleLocalChange} 
                    onBlur={handleBlur} 
                    type="number" 
                    className="font-black text-emerald-600 bg-transparent border-none p-0 w-24 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Identitas Toko */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Identitas Toko</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama Usaha</label>
              <input 
                name="name" 
                value={localCompany.name || ''} 
                onChange={handleLocalChange} 
                onBlur={handleBlur} 
                type="text" 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Alamat Lengkap</label>
              <textarea 
                name="address" 
                value={localCompany.address || ''} 
                onChange={handleLocalChange} 
                onBlur={handleBlur} 
                rows="2"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">No. Telepon / WA</label>
              <input 
                name="phone" 
                value={localCompany.phone || ''} 
                onChange={handleLocalChange} 
                onBlur={handleBlur} 
                type="text" 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200 overflow-hidden">
                {companyInfo.logo ? (
                   <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                   <Image size={20} className="text-gray-400" />
                )}
              </div>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <button className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">Ganti Logo Toko</button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Koneksi Hardware */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Koneksi Hardware</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  <Printer size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Printer Bluetooth</p>
                  <p className={`text-[10px] font-bold uppercase ${isConnected ? 'text-green-500' : 'text-gray-400'}`}>
                    {isConnected ? `Terhubung: ${btDevice.name}` : (savedDeviceName ? 'Tersimpan (Terputus)' : 'Belum Dipasangkan')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!isConnected && savedDeviceName && (
                  <button onClick={reconnectBluetooth} disabled={isConnecting} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg active:scale-95 transition-all">Sambung</button>
                )}
                <button onClick={isConnected ? disconnectBluetooth : connectBluetooth} disabled={isConnecting} className={`text-[10px] font-bold px-3 py-2 rounded-lg active:scale-95 transition-all ${isConnected ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'}`}>
                  {isConnecting ? '...' : (isConnected ? 'Putus' : 'Cari')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Manajemen Paket */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Paket Internet</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="space-y-3">
              {packages.map(pkg => (
                <div key={pkg.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{pkg.name}</p>
                    <p className="text-xs text-blue-600 font-bold">{formatRupiah(pkg.price)}</p>
                  </div>
                  <button onClick={() => onDeletePackage(pkg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
              <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Tambah Paket Baru</h4>
              <input value={newPkgName} onChange={(e)=>setNewPkgName(e.target.value)} type="text" placeholder="Nama Paket" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm font-medium"/>
              <input value={newPkgPrice} onChange={(e)=>setNewPkgPrice(e.target.value)} type="number" placeholder="Harga Paket" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm font-medium"/>
              <button onClick={handleAddPkg} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-sm shadow-md shadow-blue-200 active:scale-95 transition-all">Simpan Paket</button>
            </div>
          </div>
        </div>

        {/* Section: PWA Install (Conditional) */}
        {deferredPrompt && (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-2">
                <Printer size={22}/> Instal Aplikasi KAsir
              </h3>
              <p className="text-xs opacity-90 mb-5 leading-relaxed">Instal aplikasi untuk akses instan dan fitur printer yang lebih stabil.</p>
              <button onClick={onInstall} className="w-full bg-white text-indigo-600 font-black py-3 rounded-lg shadow-md active:scale-95 transition-all">Pasang Sekarang</button>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="pt-4">
          <button className="w-full p-4 rounded-xl border border-red-100 text-red-500 text-xs font-black flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
            <LogOut size={16} /> KELUAR DARI APLIKASI
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
