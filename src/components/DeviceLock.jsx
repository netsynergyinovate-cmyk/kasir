import { useState, useEffect, useRef } from 'react';
import { Fingerprint, Loader2, Smartphone, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDeviceLabel } from '../utils/deviceId';
import { fetchApproxLocation } from '../utils/authProfile';
import { isDeviceAuthAvailable, verifyDevice, forgetDeviceAuth } from '../utils/deviceAuth';

// Layar kunci: buka pakai kunci layar perangkat (sidik jari / Face ID / PIN HP / Windows Hello).
// Perangkat tanpa kunci layar hanya bisa keluar lalu login ulang dengan password.
const DeviceLock = ({ userId, accountName = '', onUnlock }) => {
  const [deviceLabel] = useState(getDeviceLabel);
  const [geo, setGeo] = useState({ loaded: false, location: null, ip: null });
  const [available, setAvailable] = useState(null); // null = sedang dicek
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const autoTried = useRef(false);

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyDevice(userId, accountName);
      localStorage.setItem('device_unlocked', 'true');
      onUnlock();
    } catch {
      setError('Verifikasi dibatalkan atau gagal. Coba lagi.');
    }
    setBusy(false);
  };

  useEffect(() => {
    let alive = true;
    fetchApproxLocation().then((r) => { if (alive) setGeo({ loaded: true, ...r }); });
    isDeviceAuthAvailable().then((ok) => {
      if (!alive) return;
      setAvailable(ok);
      // Langsung munculkan prompt sidik jari/Face ID; kalau browser butuh ketukan (iOS), tombol tetap ada.
      if (ok && !autoTried.current) { autoTried.current = true; unlock(); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    localStorage.removeItem('device_unlocked');
    localStorage.removeItem('kasir_user');
    forgetDeviceAuth(userId); // login ulang = daftar ulang kunci perangkat
    try { await supabase.auth.signOut(); } catch (e) { console.warn('Signout note:', e); }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
          <Fingerprint size={32} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Aplikasi Terkunci</h2>
        <p className="text-gray-500 text-sm font-medium mb-8">
          {accountName ? `Masuk sebagai ${accountName}. ` : ''}
          {available === false
            ? 'Perangkat ini belum punya kunci layar (sidik jari/Face ID/PIN). Keluar lalu login ulang dengan password.'
            : 'Buka dengan sidik jari, Face ID, PIN HP, atau Windows Hello.'}
        </p>

        {error && <p role="alert" className="text-red-600 text-sm font-bold bg-red-50 px-4 py-2 rounded-full mb-4">{error}</p>}

        {available !== false && (
          <button
            type="button"
            onClick={unlock}
            disabled={busy || available === null}
            className="w-full max-w-[280px] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-white font-bold shadow-md shadow-blue-200 active:scale-95 transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
            Buka Kunci
          </button>
        )}

        <div className="mt-8 text-[11px] text-gray-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5"><Smartphone size={12} className="shrink-0" /> {deviceLabel}</p>
          <p className="flex items-center justify-center gap-1.5">
            <MapPin size={12} className="shrink-0" />
            {!geo.loaded ? 'Mendeteksi lokasi...' : (geo.location ? `${geo.location}${geo.ip ? ` (${geo.ip})` : ''}` : 'Lokasi tidak terdeteksi')}
          </p>
        </div>

        <button type="button" onClick={logout} className="mt-6 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">
          Keluar (Logout)
        </button>
      </div>
    </div>
  );
};

export default DeviceLock;
