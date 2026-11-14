import { NavLink } from 'react-router-dom';
import { Home, Users, History, Settings as SettingsIcon, PlusCircle, Route as RouteIcon } from 'lucide-react';
import { isPathAllowedForRole } from '../utils/permissions';

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink to={to} className="flex flex-col items-center gap-1 w-14 tap-bounce group">
    {({ isActive }) => (
      <>
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
            isActive
              ? 'text-blue-600 font-black'
              : 'text-slate-400 group-hover:text-slate-600'
          }`}
        >
          <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="transition-transform" />
        </span>
        <span
          className={`text-[9px] transition-all duration-200 ${
            isActive ? 'text-blue-600 font-bold' : 'text-slate-400 group-hover:text-slate-600'
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
// Gaya dock minimalis (bar tipis + FAB melayang di tengah), lihat mockup ref.html di root proyek.
const Navigation = ({ role, allowedPaths }) => {
  const can = (path) => isPathAllowedForRole(role, path, allowedPaths);

  return (
    <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 h-14 flex justify-between items-center px-2 z-20 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] shrink-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto print:hidden">
      <div className="flex w-full justify-between items-center relative">
        <div className="flex justify-around w-[42%]">
          {can('/') && <NavItem to="/" icon={Home} label="Beranda" />}
          {can('/customers') && <NavItem to="/customers" icon={Users} label="Pelanggan" />}
        </div>

        <div className="w-[16%]"></div>

        <div className="flex justify-around w-[42%]">
          {can('/history') && <NavItem to="/history" icon={History} label="Riwayat" />}
          {can('/rute') && <NavItem to="/rute" icon={RouteIcon} label="Rute" />}
          {can('/settings') && <NavItem to="/settings" icon={SettingsIcon} label="Setting" />}
        </div>

        {can('/pos') && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-5 flex items-center justify-center z-30">
            <NavLink
              to="/pos"
              className="w-[52px] h-[52px] bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md shadow-blue-500/30 border-2 border-white hover:bg-blue-700 hover:scale-105 active:scale-90 transition-all duration-200"
              aria-label="Transaksi Kasir Baru"
            >
              <PlusCircle size={24} className="transition-transform group-hover:rotate-90" />
            </NavLink>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
