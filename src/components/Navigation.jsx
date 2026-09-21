import { NavLink } from 'react-router-dom';
import { Home, Users, History, Settings as SettingsIcon, PlusCircle, Route as RouteIcon } from 'lucide-react';

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink to={to} className="flex flex-col items-center gap-1 w-14">
    {({ isActive }) => (
      <>
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        </span>
        <span className={`text-[9px] font-bold transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
      </>
    )}
  </NavLink>
);

const Navigation = ({ role }) => {
  return (
    <nav className="bg-white/95 backdrop-blur-md border-t border-gray-100 h-[72px] flex justify-between items-center px-2 z-20 shadow-[0_-6px_20px_rgba(15,23,42,0.05)] shrink-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto print:hidden">
      <div className="flex w-full justify-between items-center relative">
        <div className="flex justify-around w-[42%]">
          <NavItem to="/" icon={Home} label="Beranda" />
          <NavItem to="/customers" icon={Users} label="Pelanggan" />
        </div>

        <div className="w-[16%]"></div>

        <div className="flex justify-around w-[42%]">
          <NavItem to="/history" icon={History} label="Riwayat" />
          {role === 'superadmin' && <NavItem to="/rute" icon={RouteIcon} label="Rute" />}
          <NavItem to="/settings" icon={SettingsIcon} label="Setting" />
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center justify-center z-30">
          <NavLink
            to="/pos"
            className="w-[60px] h-[60px] bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_10px_24px_rgba(37,99,235,0.45)] border-4 border-gray-50 active:scale-95 transition-transform mb-1"
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
