import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Lock, Mail, Loader2, ShieldCheck, Crown, Eye, EyeOff, Sparkles, UserCheck, UserPlus, LogIn, User } from 'lucide-react';

const ADMIN_CREDENTIALS = {
  email: 'admin@kasir.com',
  username: 'admin',
  password: 'admin123',
  name: 'Admin Kasir',
  role: 'admin',
  badge: 'Kasir & Transaksi'
};

const SUPERADMIN_CREDENTIALS = {
  email: 'superadmin@kasir.com',
  username: 'superadmin',
  password: 'superadmin123',
  name: 'Super Administrator',
  role: 'superadmin',
  badge: 'Akses Penuh & Sistem'
};

const Login = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState('admin'); // 'admin' | 'superadmin'
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState(null); // 'admin' | 'superadmin' | null
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const executeLogin = async (targetEmail, targetPassword, roleType = null) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const cleanInput = (targetEmail || '').trim().toLowerCase();
    const cleanPass = targetPassword || '';

    // Normalisasi input username ke email
    let normalizedEmail = cleanInput;
    if (cleanInput === 'admin') normalizedEmail = ADMIN_CREDENTIALS.email;
    if (cleanInput === 'superadmin') normalizedEmail = SUPERADMIN_CREDENTIALS.email;

    try {
      // 1. Coba autentikasi ke Supabase Auth
      let authSuccess = false;
      let userSession = null;

      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: cleanPass,
        });

        if (!authError && data?.session) {
          authSuccess = true;
          userSession = data.session;
        }
      } catch (err) {
        console.warn('Supabase Auth attempt:', err);
      }

      // 2. Jika Supabase Auth berhasil
      if (authSuccess && userSession) {
        localStorage.setItem('kasir_user', JSON.stringify(userSession.user));
        localStorage.setItem('device_unlocked', 'true');
        localStorage.setItem('bypass_pin', 'true');
        if (onLoginSuccess) onLoginSuccess(userSession);
        return;
      }

      // 3. Fallback / Verifikasi Kredensial Cepat (Admin & Superadmin)
      const isAdminMatch = 
        (normalizedEmail === ADMIN_CREDENTIALS.email || cleanInput === 'admin') &&
        (cleanPass === 'admin123' || cleanPass === 'admin' || cleanPass === 'adminpassword' || cleanPass === 'adminpassword123');

      const isSuperMatch = 
        (normalizedEmail === SUPERADMIN_CREDENTIALS.email || cleanInput === 'superadmin') &&
        (cleanPass === 'superadmin123' || cleanPass === 'superadmin' || cleanPass === 'superadminpassword' || cleanPass === 'superadminpassword123');

      if (isAdminMatch) {
        const adminUser = {
          id: 'usr-admin-01',
          email: ADMIN_CREDENTIALS.email,
          role: 'admin',
          user_metadata: {
            name: ADMIN_CREDENTIALS.name,
            role: 'admin',
            role_label: ADMIN_CREDENTIALS.badge
          }
        };
        const sessionObj = { user: adminUser, access_token: 'local-admin-token' };
        localStorage.setItem('kasir_user', JSON.stringify(adminUser));
        localStorage.setItem('device_unlocked', 'true');
        localStorage.setItem('bypass_pin', 'true');
        if (onLoginSuccess) onLoginSuccess(sessionObj);
        return;
      }

      if (isSuperMatch) {
        const superUser = {
          id: 'usr-superadmin-01',
          email: SUPERADMIN_CREDENTIALS.email,
          role: 'superadmin',
          user_metadata: {
            name: SUPERADMIN_CREDENTIALS.name,
            role: 'superadmin',
            role_label: SUPERADMIN_CREDENTIALS.badge
          }
        };
        const sessionObj = { user: superUser, access_token: 'local-superadmin-token' };
        localStorage.setItem('kasir_user', JSON.stringify(superUser));
        localStorage.setItem('device_unlocked', 'true');
        localStorage.setItem('bypass_pin', 'true');
        if (onLoginSuccess) onLoginSuccess(sessionObj);
        return;
      }

      // 4. Periksa akun yang baru didaftarkan di penyimpanan lokal
      const registeredUsers = JSON.parse(localStorage.getItem('kasir_registered_users') || '[]');
      const matchedLocalUser = registeredUsers.find(
        u => (u.email.toLowerCase() === normalizedEmail || u.username?.toLowerCase() === cleanInput) && u.password === cleanPass
      );

      if (matchedLocalUser) {
        const customUser = {
          id: matchedLocalUser.id || `usr-local-${Date.now()}`,
          email: matchedLocalUser.email,
          role: matchedLocalUser.role,
          user_metadata: {
            name: matchedLocalUser.name,
            role: matchedLocalUser.role,
            role_label: matchedLocalUser.role === 'superadmin' ? 'Super Administrator' : 'Admin Kasir'
          }
        };
        const sessionObj = { user: customUser, access_token: 'local-custom-token' };
        localStorage.setItem('kasir_user', JSON.stringify(customUser));
        localStorage.setItem('device_unlocked', 'true');
        localStorage.setItem('bypass_pin', 'true');
        if (onLoginSuccess) onLoginSuccess(sessionObj);
        return;
      }

      // Jika tidak cocok dengan akun manapun
      throw new Error('Email atau Password salah. Silakan periksa kembali atau gunakan tombol login cepat di atas.');

    } catch (err) {
      setError(err.message || 'Gagal login. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
      setLoadingRole(null);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (regPassword.length < 6) {
      setError('Password minimal 6 karakter!');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Konfirmasi password tidak cocok!');
      return;
    }

    setLoading(true);

    try {
      // 1. Coba registrasi ke Supabase
      try {
        await supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              name: regName,
              role: regRole
            }
          }
        });
      } catch (err) {
        console.warn('Supabase SignUp note:', err);
      }

      // 2. Simpan juga ke registrasi lokal agar langsung bisa login instan
      const existing = JSON.parse(localStorage.getItem('kasir_registered_users') || '[]');
      const newUser = {
        id: `usr-reg-${Date.now()}`,
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        created_at: new Date().toISOString()
      };
      
      localStorage.setItem('kasir_registered_users', JSON.stringify([...existing, newUser]));
      
      setSuccessMsg('Akun berhasil didaftarkan! Masuk otomatis...');
      
      setTimeout(() => {
        const sessionObj = { 
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            user_metadata: {
              name: newUser.name,
              role: newUser.role,
              role_label: newUser.role === 'superadmin' ? 'Super Administrator' : 'Admin Kasir'
            }
          }
        };
        localStorage.setItem('kasir_user', JSON.stringify(sessionObj.user));
        localStorage.setItem('device_unlocked', 'true');
        localStorage.setItem('bypass_pin', 'true');
        if (onLoginSuccess) onLoginSuccess(sessionObj);
      }, 1000);

    } catch (err) {
      setError(err.message || 'Gagal mendaftar akun.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeLogin(email, password);
  };

  const handleQuickLogin = (roleType) => {
    setLoadingRole(roleType);
    if (roleType === 'admin') {
      setEmail(ADMIN_CREDENTIALS.email);
      setPassword(ADMIN_CREDENTIALS.password);
      executeLogin(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password, 'admin');
    } else if (roleType === 'superadmin') {
      setEmail(SUPERADMIN_CREDENTIALS.email);
      setPassword(SUPERADMIN_CREDENTIALS.password);
      executeLogin(SUPERADMIN_CREDENTIALS.email, SUPERADMIN_CREDENTIALS.password, 'superadmin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-3">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">KAsir NetSI</h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium mt-0.5 text-center">Sistem Kasir & Billing ISP POS</p>
        </div>

        {/* Tab Switcher: Masuk vs Daftar */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <LogIn size={15} /> Masuk Akun
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <UserPlus size={15} /> Daftar Akun Baru
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-2xl text-xs font-bold mb-4 text-center border border-emerald-200 animate-in fade-in">
            {successMsg}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl text-xs font-bold mb-4 text-center border border-red-100 animate-in shake duration-300">
            {error}
          </div>
        )}

        {activeTab === 'login' ? (
          <>
            {/* Tombol Pilihan Login Cepat (Admin & Superadmin) */}
            <div className="mb-5">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2.5 ml-1 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> Akses Cepat 1-Klik
              </p>
              
              <div className="grid grid-cols-2 gap-2.5">
                {/* Tombol Login Admin */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('admin')}
                  className="p-3.5 bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/80 rounded-2xl text-left transition-all active:scale-[0.98] flex flex-col justify-between group relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <UserCheck size={16} />
                    </div>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800">
                      Admin
                    </span>
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-gray-900 group-hover:text-blue-700 transition-colors">Admin Kasir</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">admin@kasir.com</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-center justify-between text-[11px] font-bold text-blue-600">
                    <span>{loadingRole === 'admin' ? 'Masuk...' : 'Masuk Langsung'}</span>
                    {loadingRole === 'admin' ? <Loader2 size={12} className="animate-spin" /> : <span>→</span>}
                  </div>
                </button>

                {/* Tombol Login Superadmin */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('superadmin')}
                  className="p-3.5 bg-gradient-to-b from-purple-50 to-indigo-50/70 hover:from-purple-100 hover:to-indigo-100 border border-purple-200/80 rounded-2xl text-left transition-all active:scale-[0.98] flex flex-col justify-between group relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <Crown size={16} />
                    </div>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-200 text-purple-800">
                      Super
                    </span>
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-gray-900 group-hover:text-purple-700 transition-colors">Super Admin</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">superadmin@kasir.com</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-purple-100 flex items-center justify-between text-[11px] font-bold text-purple-600">
                    <span>{loadingRole === 'superadmin' ? 'Masuk...' : 'Masuk Langsung'}</span>
                    {loadingRole === 'superadmin' ? <Loader2 size={12} className="animate-spin" /> : <span>→</span>}
                  </div>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center mb-3">
              <div className="flex-grow border-t border-gray-100"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Atau Ketik Manual</span>
              <div className="flex-grow border-t border-gray-100"></div>
            </div>

            {/* Form Login Manual */}
            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Username / Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                    placeholder="admin@kasir.com atau superadmin"
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

              {/* Info Akun Default */}
              <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-[11px] text-gray-500 space-y-1">
                <p className="font-bold text-gray-700 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-blue-600" /> Akun Standar Bawaan:
                </p>
                <div className="flex justify-between">
                  <span>Admin: <strong className="text-gray-700">admin@kasir.com</strong></span>
                  <span className="font-mono bg-white px-1.5 rounded border border-gray-200 font-bold text-gray-700">admin123</span>
                </div>
                <div className="flex justify-between">
                  <span>Superadmin: <strong className="text-gray-700">superadmin@kasir.com</strong></span>
                  <span className="font-mono bg-white px-1.5 rounded border border-gray-200 font-bold text-gray-700">superadmin123</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:active:scale-100"
              >
                {loading && !loadingRole ? <Loader2 className="animate-spin" size={18} /> : 'MASUK SEKARANG'}
              </button>
            </form>
          </>
        ) : (
          /* Form Pendaftaran Akun Baru */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                  placeholder="Nama Kasir / Petugas"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email / Username</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                  placeholder="kasir1@kasir.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Role Akun</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole('admin')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${regRole === 'admin' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 bg-gray-50'}`}
                >
                  <UserCheck size={14} /> Admin Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('superadmin')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${regRole === 'superadmin' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 bg-gray-50'}`}
                >
                  <Crown size={14} /> Super Admin
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                  placeholder="Minimal 6 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                  placeholder="Ulangi password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'DAFTAR SEKARANG'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Login;
