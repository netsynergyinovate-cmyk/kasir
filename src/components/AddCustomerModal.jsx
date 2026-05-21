import React from 'react';
import { X, Calendar } from 'lucide-react';
import { formatRupiah } from '../utils/format';

const AddCustomerModal = ({ show, packages, onClose, onAdd }) => {
  if(!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const newCustomer = {
      id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
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

export default AddCustomerModal;
