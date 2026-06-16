import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const EditCustomerModal = ({ customer, packages = [], onClose, onSave }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nickname: '',
    address: '',
    package: '',
    dueDate: ''
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        id: customer.id,
        name: customer.name || '',
        nickname: customer.nickname || '',
        address: customer.address || '',
        package: customer.package || '',
        dueDate: customer.due_date || customer.dueDate || ''
      });
    }
  }, [customer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h2 className="font-bold text-lg">Edit Pelanggan</h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-lg transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
            <input required name="name" value={formData.name} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Panggilan</label>
            <input name="nickname" value={formData.nickname} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat</label>
            <textarea required name="address" value={formData.address} onChange={handleChange} rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Paket</label>
              <select required name="package" value={formData.package} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-700">
                <option value="">Pilih Paket...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.name}>{pkg.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tgl Jatuh Tempo</label>
              <input required name="dueDate" value={formData.dueDate} onChange={handleChange} type="number" min="1" max="31" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl mt-6 shadow-md hover:bg-blue-700 active:scale-95 transition-all">
            Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerModal;
