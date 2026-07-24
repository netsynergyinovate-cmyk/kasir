import React, { useState } from 'react';
import { X, Calendar, Wifi, RefreshCw, Key, Search, Phone, Network } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { fetchCustomerByPppoe } from '../utils/billingApi';

const AddCustomerModal = ({ show, packages = [], companyInfo, onClose, onAdd }) => {
  const [pppoeId, setPppoeId] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isFetchingEbilling, setIsFetchingEbilling] = useState(false);
  const [ebillingMessage, setEbillingMessage] = useState(null);

  if (!show) return null;

  const handleFetchEbilling = async () => {
    if (!pppoeId) {
      setEbillingMessage({ type: 'error', text: 'Masukkan ID PPPoE terlebih dahulu.' });
      return;
    }
    setIsFetchingEbilling(true);
    setEbillingMessage(null);

    const res = await fetchCustomerByPppoe(pppoeId, companyInfo?.apiMonitoringUrl, companyInfo?.apiMonitoringKey);
    setIsFetchingEbilling(false);

    if (res.success && res.customer) {
      const c = res.customer;
      setName(c.name || '');
      setNickname(c.nickname || '');
      setAddress(c.address || '');
      setPhone(c.phone || '');
      setIpAddress(c.ip_address || c.ipAddress || '');
      if (c.package) setSelectedPackage(c.package);
      if (c.due_date) setDueDate(c.due_date.toString());
      setEbillingMessage({ type: 'success', text: `Data E-Billing terhubung! Nama: ${c.name}` });
    } else {
      setEbillingMessage({ type: 'error', text: res.message || 'Pelanggan tidak ditemukan di E-Billing.' });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newCustomer = {
      id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      pppoe_id: pppoeId.trim() || null,
      pppoeId: pppoeId.trim() || null,
      name,
      nickname,
      address,
      phone,
      ip_address: ipAddress,
      ipAddress: ipAddress,
      package: selectedPackage,
      status: 'aktif',
      dueDate: parseInt(dueDate) || 15
    };
    onAdd(newCustomer);

    // Reset state
    setPppoeId('');
    setName('');
    setNickname('');
    setAddress('');
    setPhone('');
    setIpAddress('');
    setSelectedPackage('');
    setDueDate('');
    setEbillingMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2">
            <Wifi size={20} />
            <h3 className="font-bold text-lg">Tambah Pelanggan Baru</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-full"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* E-Billing Auto Pull Feature */}
          <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100 space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                <Key size={14} className="text-blue-600" /> ID PPPoE (E-Billing)
              </label>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-100/80 px-2 py-0.5 rounded-md">Sinkron E-Billing</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={pppoeId}
                onChange={(e) => setPppoeId(e.target.value)}
                placeholder="Contoh: budi_rt01@net"
                className="w-full p-2.5 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono font-medium"
              />
              <button 
                type="button"
                onClick={handleFetchEbilling}
                disabled={isFetchingEbilling}
                className="bg-blue-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl hover:bg-blue-700 shrink-0 flex items-center gap-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isFetchingEbilling ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <>
                    <Search size={14} /> Tarik Data
                  </>
                )}
              </button>
            </div>
            {ebillingMessage && (
              <p className={`text-[11px] font-bold ${ebillingMessage.type === 'success' ? 'text-emerald-700' : 'text-amber-700'} mt-1`}>
                {ebillingMessage.text}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nama Lengkap</label>
              <input 
                required 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                placeholder="Contoh: Budi Santoso"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nama Panggilan</label>
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                placeholder="Contoh: Budi"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase flex items-center gap-1">
                <Phone size={12}/> No. WhatsApp / HP
              </label>
              <input 
                type="text" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                placeholder="081234567890"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase flex items-center gap-1">
                <Network size={12}/> IP Address PPPoE
              </label>
              <input 
                type="text" 
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono" 
                placeholder="10.20.1.101"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Pemasangan</label>
            <input 
              required 
              type="text" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
              placeholder="Blok / No Rumah"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Paket Internet</label>
            <select 
              required 
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-gray-700"
            >
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
               <input 
                 required 
                 type="number" 
                 min="1" 
                 max="31" 
                 value={dueDate}
                 onChange={(e) => setDueDate(e.target.value)}
                 className="w-full bg-transparent outline-none text-sm p-1 font-bold" 
                 placeholder="Tgl (1-31)"
               />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl mt-4 hover:bg-blue-700 shadow-md active:scale-95 transition-all">
            Simpan Pelanggan
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
