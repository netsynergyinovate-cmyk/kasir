import { NavLink } from 'react-router-dom';
import { Home, Users, History, Settings as SettingsIcon, PlusCircle, Route as RouteIcon } from 'lucide-react';
import { isPathAllowedForRole } from '../utils/permissions';

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink to={to} className="flex flex-col items-center gap-1 w-14 tap-bounce group">
    {({ isActive }) => (
      <>
        <span
          className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200 ${
            isActive
              ? 'bg-blue-50 text-blue-600 scale-105 shadow-xs font-black'
              : 'text-gray-400 group-hover:text-gray-600 group-hover:scale-105'
          }`}
        >
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="transition-transform" />
        </span>
        <span
          className={`text-[9px] font-bold transition-all duration-200 ${
            isActive ? 'text-blue-600 scale-105 font-black' : 'text-gray-400 group-hover:text-gray-600'
          }`}
        >
          {label}
        </span>
      </>
    )}
  </NavLink>
);

// allowedPaths: menu KHUSUS admin ini (admin_profiles.allowed_paths), diatur superadmin per akun — lihat
// utils/permissions.js. null berarti belum diatur, pakai daftar bawaan (perilaku lama, semua admin sama).
const Navigation = ({ role, allowedPaths }) => {
  const can = (path) => isPathAllowedForRole(role, path, allowedPaths);

  return (
    <nav className="bg-white/95 backdrop-blur-md border-t border-gray-100 h-[72px] flex justify-between items-center px-2 z-20 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] shrink-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto print:hidden">
      <div className="flex w-full justify-between items-center relative">
        <div className="flex justify-around w-[42%]">
          {can('/') && <NavItem to="/" icon={Home} label="Beranda" />}
          {can('/customers') && <NavItem to="/customers" icon={Users} label="Pelanggan" />}
        </div>

        <div className="w-[16%]"></div>

        <div className="flex justify-around w-[42%]">
          {can('/history') && <NavItem to="/history" icon={History} label="Riwayat" />}
          {role === 'superadmin' && <NavItem to="/rute" icon={RouteIcon} label="Rute" />}
          {can('/settings') && <NavItem to="/settings" icon={SettingsIcon} label="Setting" />}
        </div>

        {can('/pos') && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center justify-center z-30">
            <NavLink
              to="/pos"
              className="w-[60px] h-[60px] bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_10px_25px_rgba(37,99,235,0.45)] border-4 border-gray-50 hover:scale-105 active:scale-90 transition-all duration-200 mb-1 animate-float-gentle animate-pulse-glow"
              aria-label="Transaksi Kasir Baru"
            >
              <PlusCircle size={28} className="transition-transform group-hover:rotate-90" />
            </NavLink>
            <span className="text-[10px] font-black tracking-tight text-gray-700 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-sm border border-gray-100 whitespace-nowrap hover:scale-105 transition-transform">
              Transaksi Baru
            </span>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
