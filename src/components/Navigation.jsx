import { NavLink } from 'react-router-dom';
import { Home, Users, History, Settings as SettingsIcon, PlusCircle } from 'lucide-react';

const Navigation = () => {
  return (
    <nav className="bg-white border-t border-gray-200 h-[72px] flex justify-between items-center px-2 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.03)] shrink-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto print:hidden">
      <div className="flex w-full justify-between items-center relative">
        <div className="flex justify-around w-[40%]">
          <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 w-14 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
            <Home size={22} className="fill-current opacity-20" />
            <span className="text-[9px] font-bold">Beranda</span>
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `flex flex-col items-center gap-1 w-14 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
            <Users size={22} className="fill-current opacity-20" />
            <span className="text-[9px] font-bold">Pelanggan</span>
          </NavLink>
        </div>

        <div className="w-[20%]"></div>

        <div className="flex justify-around w-[40%]">
           <NavLink to="/history" className={({ isActive }) => `flex flex-col items-center gap-1 w-14 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
            <History size={22} className="fill-current opacity-20" />
            <span className="text-[9px] font-bold">Riwayat</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center gap-1 w-14 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
            <SettingsIcon size={22} className="fill-current opacity-20" />
            <span className="text-[9px] font-bold">Setting</span>
          </NavLink>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center justify-center z-30">
          <NavLink 
            to="/pos" 
            className="w-[60px] h-[60px] bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(37,99,235,0.4)] border-4 border-gray-50 active:scale-95 transition-transform mb-1"
          >
            <PlusCircle size={28} />
          </NavLink>
          <span className="text-[10px] font-black tracking-tight text-gray-700 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-sm border border-gray-100 whitespace-nowrap">
            Transaksi Baru
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
