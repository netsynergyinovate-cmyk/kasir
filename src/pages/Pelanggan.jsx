import React, { useState } from 'react';
import { Search, PlusCircle, Wifi, Trash2 } from 'lucide-react';

const Pelanggan = ({ customers = [], setShowAddCustomer, onDeleteCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.nickname && c.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Data Pelanggan</h2>
        <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200">
          <PlusCircle size={16} /> Tambah
        </button>
      </div>
      <div className="bg-white flex items-center p-2 rounded-2xl border border-gray-200 shadow-sm">
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
          <div key={cust.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 flex">
               <div className="bg-gray-50 px-3 py-1.5 rounded-bl-xl border-b border-l border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500">Jatuh Tempo: <span className="text-red-500">Tgl {cust.due_date || cust.dueDate}</span></p>
               </div>
               <button 
                onClick={() => {
                  if (window.confirm(`Hapus pelanggan "${cust.name}" secara permanen? Semua riwayat tidak akan hilang tapi data pelanggan akan dihapus.`)) {
                    onDeleteCustomer(cust.id);
                  }
                }}
                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
               >
                 <Trash2 size={14} />
               </button>
            </div>
            <div className="flex items-start gap-3 mt-2">
              <div className="relative">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg uppercase">
                  {cust.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <div className="flex-1 pr-16">
                <p className="font-bold text-gray-800 leading-tight">
                  {cust.name} {cust.nickname && <span className="text-gray-400 font-medium text-[11px]">({cust.nickname})</span>}
                </p>
                <p className="text-xs font-medium text-blue-600 mt-0.5">{cust.package}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100 flex items-start gap-1.5">
              <Wifi size={14} className="mt-0.5 text-blue-500 shrink-0" /> 
              <span className="leading-tight">{cust.address}</span>
            </p>
          </div>
        )) : (
          <div className="text-center py-10 opacity-50 italic text-sm">Pelanggan tidak ditemukan...</div>
        )}
      </div>
    </div>
  );
};

export default Pelanggan;
