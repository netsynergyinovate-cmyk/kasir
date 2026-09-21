import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Lock, Mail, Loader2, Eye, EyeOff, Smartphone, MapPin } from 'lucide-react';
import { getDeviceLabel } from '../utils/deviceId';
import { fetchApproxLocation } from '../utils/authProfile';

const Login = ({ externalError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [geo, setGeo] = useState({ loaded: false, ip: null, location: null });
  const deviceLabel = getDeviceLabel();

  useEffect(() => {
    let cancelled = false;
    fetchApproxLocation().then((result) => {
      if (!cancelled) setGeo({ loaded: true, ...result });
    });
    return () => { cancelled = true; };
  }, []);

  // Setelah signIn berhasil, App.jsx (onAuthStateChange) yang memverifikasi profil + device-lock
  // dan menampilkan penolakannya lewat prop externalError.
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) setError('Email atau password salah.');
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    if (oauthError) {
      setError('Gagal memulai login Google: ' + oauthError.message);
      setGoogleLoading(false);
    }
  };

  const shownError = error || externalError;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-3">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">KAsir NetSI</h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium mt-0.5 text-center">Sistem Kasir & Billing ISP POS</p>
        </div>

        {shownError && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl text-xs font-bold mb-4 text-center border border-red-100 animate-in shake duration-300">
            {shownError}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-3.5 rounded-xl border border-gray-200 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:active:scale-100"
        >
          {googleLoading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          Masuk dengan Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">atau</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                placeholder="nama@usaha.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'MASUK SEKARANG'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-gray-100 text-[11px] text-gray-500 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Perangkat ini</p>
          <p className="flex items-center gap-1.5"><Smartphone size={12} className="shrink-0" /> {deviceLabel}</p>
          <p className="flex items-center gap-1.5">
            <MapPin size={12} className="shrink-0" />
            {!geo.loaded ? 'Mendeteksi lokasi...' : (geo.location ? `${geo.location}${geo.ip ? ` (${geo.ip})` : ''}` : 'Lokasi tidak terdeteksi')}
          </p>
        </div>

      </div>
    </div>
  );
};

export default Login;
