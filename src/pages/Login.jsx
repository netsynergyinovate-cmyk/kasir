import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react';
import { getOrCreateDeviceId, getDeviceLabel } from '../utils/deviceId';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data?.session) {
        throw new Error('Email atau password salah.');
      }

      const userId = data.session.user.id;
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('id, full_name, role, device_id, device_label')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Akun ini belum terdaftar sebagai admin/superadmin di sistem.');
      }

      if (profile.role === 'admin') {
        const currentDeviceId = getOrCreateDeviceId();
        const currentDeviceLabel = getDeviceLabel();

        if (!profile.device_id) {
          const { error: bindError } = await supabase
            .from('admin_profiles')
            .update({ device_id: currentDeviceId, device_label: currentDeviceLabel })
            .eq('id', userId);

          if (bindError) {
            await supabase.auth.signOut();
            throw new Error('Gagal mengunci akun ke device ini: ' + bindError.message);
          }

          profile.device_id = currentDeviceId;
          profile.device_label = currentDeviceLabel;
        } else if (profile.device_id !== currentDeviceId) {
          await supabase.auth.signOut();
          throw new Error('Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device.');
        }
      }

      if (onLoginSuccess) onLoginSuccess({ ...data.session, profile });
    } catch (err) {
      setError(err.message || 'Gagal login. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

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

        {error && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl text-xs font-bold mb-4 text-center border border-red-100 animate-in shake duration-300">
            {error}
          </div>
        )}

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
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'MASUK SEKARANG'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
