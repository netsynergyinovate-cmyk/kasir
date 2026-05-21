import React, { useState } from 'react';
import { Building2, Wifi, Trash2, Bluetooth, BluetoothConnected, BluetoothOff, AlertCircle } from 'lucide-react';
import { formatRupiah } from '../utils/format';

const Settings = ({ 
  packages, onAddPackage, onDeletePackage, companyInfo, setCompanyInfo, 
  btDevice, isConnecting, connectBluetooth, disconnectBluetooth, savedDeviceName 
}) => {
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyInfo({ ...companyInfo, [name]: value });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyInfo({ ...companyInfo, logo: reader.result });
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
    <div className="p-4 pb-32 space-y-6 animate-in fade-in duration-300">
      
      {/* Bluetooth Printer Section */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-3">
          <Bluetooth size={18} className="text-blue-600"/> Printer Thermal Bluetooth
        </h3>
        
        <div className="flex flex-col gap-4">
          <div className={`p-4 rounded-2xl flex items-center justify-between transition-colors ${isConnected ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="p-2 bg-green-500 text-white rounded-full">
                  <BluetoothConnected size={20}/>
                </div>
              ) : (
                <div className="p-2 bg-gray-200 text-gray-500 rounded-full">
                  <BluetoothOff size={20}/>
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-gray-800">
                  {isConnected ? btDevice.name : savedDeviceName || 'Tidak Ada Printer'}
                </p>
                <p className="text-[10px] text-gray-500 uppercase font-medium">
                  {isConnected ? 'Status: Terkoneksi' : 'Status: Terputus'}
                </p>
              </div>
            </div>
            
            {isConnected ? (
              <button onClick={disconnectBluetooth} className="text-xs font-bold text-red-600 px-4 py-2 bg-white border border-red-100 rounded-xl shadow-sm active:scale-95 transition-all">
                Putuskan
              </button>
            ) : (
              <button 
                onClick={connectBluetooth} 
                disabled={isConnecting}
                className="text-xs font-bold text-blue-600 px-4 py-2 bg-white border border-blue-100 rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isConnecting ? 'Mencari...' : 'Hubungkan'}
              </button>
            )}
          </div>
          
          <p className="text-[10px] text-gray-400 italic px-1 leading-relaxed">
            {isConnected 
              ? 'Printer siap digunakan untuk mencetak struk kasir.' 
              : 'Gunakan tombol hubungkan untuk memindai printer thermal di sekitar Anda.'}
          </p>
        </div>
      </div>

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
            <input name="name" value={companyInfo.name || ''} onChange={handleCompanyChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Alamat</label>
            <textarea name="address" value={companyInfo.address || ''} onChange={handleCompanyChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" rows="2"></textarea>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">No. Telepon / WA</label>
            <input name="phone" value={companyInfo.phone || ''} onChange={handleCompanyChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"/>
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
              <button onClick={() => onDeletePackage(pkg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
           <h4 className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wider">Tambah Paket Baru</h4>
           <div className="space-y-3">
             <input value={newPkgName} onChange={(e)=>setNewPkgName(e.target.value)} type="text" placeholder="Nama Paket" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm"/>
             <input value={newPkgPrice} onChange={(e)=>setNewPkgPrice(e.target.value)} type="number" placeholder="Harga" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm"/>
             <button onClick={handleAddPkg} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700">Simpan Paket</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
