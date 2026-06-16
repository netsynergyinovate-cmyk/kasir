import React, { useState } from 'react';
import { Search, PlusCircle, Wifi, Trash2, Pencil, MapPin } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';

const Pelanggan = ({ customers = [], packages = [], setShowAddCustomer, onDeleteCustomer, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.nickname && c.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveEdit = (updatedData) => {
    onUpdateCustomer(updatedData);
    setEditingCustomer(null);
  };

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Data Pelanggan</h2>
        <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200">
          <PlusCircle size={16} /> Tambah
        </button>
      </div>
      <div className="bg-white flex items-center p-2 rounded-xl border border-gray-200 shadow-sm">
        <Search size={20} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama, panggilan, atau alamat..." 
          className="bg-transparent border-none outline-none p-2 w-full text-sm" 
        />
      </div>

      <div className="space-y-3 mt-4">
        {filteredCustomers.length > 0 ? filteredCustomers.map((cust) => (
          <div key={cust.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm group">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold uppercase">
                  {cust.name.substring(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-gray-800 leading-tight">
                    {cust.name} {cust.nickname && <span className="text-gray-400 font-medium text-[11px]">({cust.nickname})</span>}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                    <Wifi size={10} className="text-blue-500" /> {cust.package}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 flex items-start gap-1">
                    <MapPin size={10} className="text-gray-400 mt-0.5 shrink-0" /> <span className="leading-tight">{cust.address}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className="bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-500">TGL <span className="text-red-500">{cust.due_date || cust.dueDate}</span></p>
                </div>
                <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                  <button 
                    onClick={() => setEditingCustomer(cust)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`Hapus pelanggan "${cust.name}" secara permanen? Semua riwayat tidak akan hilang tapi data pelanggan akan dihapus.`)) {
                        onDeleteCustomer(cust.id);
                      }
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-10 opacity-50 italic text-sm">Pelanggan tidak ditemukan...</div>
        )}
      </div>

      {editingCustomer && (
        <EditCustomerModal 
          customer={editingCustomer} 
          packages={packages} 
          onClose={() => setEditingCustomer(null)} 
          onSave={handleSaveEdit} 
        />
      )}
    </div>
  );
};

export default Pelanggan;
