import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, Home, Users, Printer, Settings as SettingsIcon, Building2, ChevronRight } from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen, companyInfo }) => {
  return (
    <>
      <div 
        className={`fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 print:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsOpen(false)}
      ></div>
      
      <div className={`fixed top-0 left-0 h-full w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out shadow-2xl print:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="p-6 bg-gradient-to-br from-blue-700 to-blue-900 text-white flex flex-col items-start gap-4">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
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
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Layanan Utama</div>
            <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Home size={20} /> Beranda
            </NavLink>
            <NavLink to="/customers" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Users size={20} /> Pelanggan Retail
            </NavLink>
            <NavLink to="/pos" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Printer size={20} /> Kasir (58mm)
            </NavLink>
            <NavLink to="/settings" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <SettingsIcon size={20} /> Pengaturan
            </NavLink>

            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Layanan Korporat / B2B</div>
            <NavLink to="/instansi" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center justify-between px-3 py-4 rounded-2xl transition-all border-2 ${isActive ? 'border-gray-900 bg-gray-900 text-white font-bold shadow-lg shadow-gray-200' : 'border-transparent text-gray-800 hover:bg-gray-100 font-medium'}`}>
              <div className="flex items-center gap-3">
                 <Building2 size={20} className="text-blue-400"/> 
                 <div className="text-left">
                   <p className="text-sm">Invoice Instansi</p>
                   <p className="text-[9px] text-gray-400">Format Cetak A4</p>
                 </div>
              </div>
              <ChevronRight size={16} className="opacity-50" />
            </NavLink>
         </div>
      </div>
    </>
  );
};

export default Sidebar;
