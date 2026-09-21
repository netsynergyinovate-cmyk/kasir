import { NavLink } from 'react-router-dom';
import { X, Home, Users, Printer, Settings as SettingsIcon, Building2, ChevronRight, Activity, LogOut, ShieldCheck, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Sidebar = ({ isOpen, setIsOpen, companyInfo, session }) => {
  const isSuper = session?.profile?.role === 'superadmin';
  const roleName = isSuper ? 'Super Admin' : (session?.profile?.full_name || 'Admin Kasir');
  const roleBadge = isSuper ? 'Super Administrator' : 'Admin POS';

  const handleLogout = async () => {
    if (window.confirm('Yakin ingin keluar dari aplikasi? Anda harus login kembali saat masuk.')) {
      localStorage.removeItem('device_unlocked');
      localStorage.removeItem('kasir_user');
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Signout note:', e);
      }
      window.location.reload();
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 print:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsOpen(false)}
      ></div>
      
      <div className={`fixed top-0 left-0 h-full w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out shadow-2xl print:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="p-6 bg-gradient-to-br from-blue-700 to-blue-900 text-white flex flex-col items-start gap-3">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
              <X size={18} />
            </button>
            {companyInfo.logo ? (
               <img src={companyInfo.logo} alt="Logo" className="w-14 h-14 rounded-2xl object-contain bg-white p-1" />
            ) : (
               <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><Building2 size={26}/></div>
            )}
            <div className="w-full">
              <h2 className="font-bold text-base leading-tight truncate">{companyInfo.name}</h2>
              <div className="mt-1.5 flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg w-fit border border-white/10">
                {isSuper ? <Crown size={13} className="text-amber-300" /> : <ShieldCheck size={13} className="text-blue-300" />}
                <span className="text-[11px] font-bold text-white truncate">{roleName}</span>
                <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded text-blue-100 font-semibold">{roleBadge}</span>
              </div>
            </div>
         </div>
         
         <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-2">Layanan Utama</div>
            {isSuper && (
              <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Home size={18} /> Beranda
              </NavLink>
            )}
            <NavLink to="/customers" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Users size={18} /> Pelanggan Retail
            </NavLink>
            <NavLink to="/pos" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Printer size={18} /> Kasir (58mm)
            </NavLink>
            {isSuper && (
              <NavLink to="/aktivitas" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Activity size={18} /> Aktivitas Kasir
              </NavLink>
            )}
            <NavLink to="/settings" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <SettingsIcon size={18} /> Pengaturan
            </NavLink>

            {isSuper && (
              <>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Layanan Korporat / B2B</div>
                <NavLink to="/instansi" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center justify-between px-3 py-3.5 rounded-2xl transition-all border-2 ${isActive ? 'border-gray-900 bg-gray-900 text-white font-bold shadow-lg shadow-gray-200' : 'border-transparent text-gray-800 hover:bg-gray-100 font-medium'}`}>
                  <div className="flex items-center gap-3">
                     <Building2 size={18} className="text-blue-400"/> 
                     <div className="text-left">
                       <p className="text-sm">Invoice Instansi</p>
                       <p className="text-[9px] text-gray-400">Format Cetak A4</p>
                     </div>
                  </div>
                  <ChevronRight size={16} className="opacity-50" />
                </NavLink>
              </>
            )}
         </div>

         <div className="p-3 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all active:scale-95"
            >
              <LogOut size={16} /> Keluar Akun
            </button>
         </div>
      </div>
    </>
  );
};

export default Sidebar;
