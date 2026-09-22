import React, { useState, useEffect } from 'react';
import {
  Building2, Wifi, Trash2, Bluetooth, BluetoothConnected,
  BluetoothOff, AlertCircle, Printer, User, LogOut, Image, ChevronRight,
  Key, Globe, Eye, EyeOff, Activity, CheckCircle2, XCircle, Send,
  Zap, Clock, RefreshCw, Server, ShieldCheck, Crown, SlidersHorizontal, Users, MessageCircle
} from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { supabase } from '../lib/supabase';
import { testBillingSystemConnection, getEbillingLogs, clearEbillingLogs } from '../utils/billingApi';
import AdminAccountsPanel from '../components/AdminAccountsPanel';
import RunsnetSyncPanel from '../components/RunsnetSyncPanel';
import ToggleSwitch from '../components/ToggleSwitch';
import { resizeImageFile } from '../utils/imageResize';

const Settings = ({ 
  packages, onAddPackage, onDeletePackage, companyInfo, setCompanyInfo, 
  btDevice, isConnecting, connectBluetooth, disconnectBluetooth, reconnectBluetooth, savedDeviceName,
  deferredPrompt, onInstall, onSyncEbilling, onUpdateMyName, session
}) => {
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [myName, setMyName] = useState('');
  const [savingMyName, setSavingMyName] = useState(false);
  const [myNameError, setMyNameError] = useState(null);
  const [localCompany, setLocalCompany] = useState(companyInfo);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isSyncingCust, setIsSyncingCust] = useState(false);
  const [syncCustResult, setSyncCustResult] = useState(null);
  const [testApiResult, setTestApiResult] = useState(null);
  const [ebillingLogs, setEbillingLogs] = useState([]);
  const [livePingStatus, setLivePingStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('umum');
  const [showWatbizToken, setShowWatbizToken] = useState(false);
  const [watbizTestNumber, setWatbizTestNumber] = useState('');
  const [isTestingWatbiz, setIsTestingWatbiz] = useState(false);
  const [watbizTestResult, setWatbizTestResult] = useState(null);
  const [watbizLogs, setWatbizLogs] = useState([]);

  const loadWatbizLogs = async () => {
    const { data } = await supabase.from('watbiz_logs').select('*').order('sent_at', { ascending: false }).limit(30);
    if (data) setWatbizLogs(data);
  };

  const currentUser = session?.user;
  const isSuper = session?.profile?.role === 'superadmin';
  const myFullName = session?.profile?.full_name || '';

  useEffect(() => {
    setMyName(myFullName);
  }, [myFullName]);

  // Nama tampilan akun yang SEDANG login (header, struk) — tiap admin/superadmin mengatur miliknya
  // sendiri, bukan satu nama bersama untuk semua akun (lihat handleUpdateMyName di App.jsx).
  const saveMyName = async () => {
    const trimmed = myName.trim();
    if (!trimmed || trimmed === myFullName) { setMyName(myFullName); return; }
    setSavingMyName(true);
    setMyNameError(null);
    const error = await onUpdateMyName?.(trimmed);
    if (error) setMyNameError(error);
    setSavingMyName(false);
  };

  const TABS = [
    { key: 'umum', label: 'Umum', icon: SlidersHorizontal },
    ...(isSuper ? [
      { key: 'toko', label: 'Toko', icon: Building2 },
      { key: 'ebilling', label: 'E-Billing', icon: Activity },
      { key: 'watbiz', label: 'WhatsApp', icon: MessageCircle },
      { key: 'admin', label: 'Admin', icon: Users },
      { key: 'runsnet', label: 'Runsnet', icon: Zap },
    ] : []),
  ];

  // Tombol "Test Ping" WhatsApp (Watbiz): kirim satu pesan tes sungguhan lewat proxy server
  // (api/watbiz/ping.js), supaya token tervalidasi tanpa diblokir CORS dan tanpa expose token
  // dari sisi client ke domain lain.
  const handleTestWatbiz = async () => {
    if (!localCompany.watbizToken) {
      setWatbizTestResult({ success: false, message: 'Isi token Watbiz terlebih dahulu.' });
      return;
    }
    if (!watbizTestNumber.trim()) {
      setWatbizTestResult({ success: false, message: 'Isi nomor WhatsApp tujuan tes (contoh: 628123456789).' });
      return;
    }
    setIsTestingWatbiz(true);
    setWatbizTestResult(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch('/api/watbiz/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ token: localCompany.watbizToken, to: watbizTestNumber.trim(), senderName: myFullName || null }),
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        setWatbizTestResult({ success: true, message: `Pesan tes terkirim ke ${watbizTestNumber.trim()}.`, detail: JSON.stringify(result.body) });
      } else {
        setWatbizTestResult({ success: false, message: result.error || 'Watbiz menolak permintaan.', detail: JSON.stringify(result.body || result) });
      }
      loadWatbizLogs();
    } catch (err) {
      setWatbizTestResult({ success: false, message: 'Gagal menghubungi server: ' + err.message });
    }
    setIsTestingWatbiz(false);
  };

  // Sync local state & load API Key guarantee from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('api_monitoring_key') || '';
    const keyToUse = companyInfo.apiMonitoringKey || savedKey;

    setLocalCompany(prev => ({
      ...companyInfo,
      apiMonitoringKey: keyToUse
    }));

    setEbillingLogs(getEbillingLogs());
  }, [companyInfo]);

  useEffect(() => {
    if (activeTab === 'watbiz') loadWatbizLogs();
  }, [activeTab]);

  // Periodic Live Ping Heartbeat (Menjalankan tes ping tiap 10 detik saat API Key ada)
  useEffect(() => {
    const activeKey = localCompany.apiMonitoringKey || localStorage.getItem('api_monitoring_key') || '';
    if (!activeKey) return;

    const runPing = async () => {
      const res = await testBillingSystemConnection('', activeKey);
      setLivePingStatus(res);
      setEbillingLogs(getEbillingLogs());
    };

    runPing();
    const intervalId = setInterval(runPing, 10000);
    return () => clearInterval(intervalId);
  }, [localCompany.apiMonitoringKey]);

  const handleTestApi = async () => {
    if (!localCompany.apiMonitoringKey) {
      setTestApiResult({ 
        success: false, 
        message: 'Harap isi API Key Aplikasi Monitoring terlebih dahulu.' 
      });
      return;
    }
    setIsTestingApi(true);
    setTestApiResult(null);
    const result = await testBillingSystemConnection(localCompany.apiMonitoringUrl || '', localCompany.apiMonitoringKey);
    setTestApiResult(result);
    setIsTestingApi(false);
  };

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

  const handleLocalChange = (e) => {
    const { name, value } = e.target;
    setLocalCompany({ ...localCompany, [name]: value });
  };

  const handleBlur = () => {
    // Only update if there's a difference
    if (JSON.stringify(localCompany) !== JSON.stringify(companyInfo)) {
      setCompanyInfo(localCompany);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const logo = await resizeImageFile(file);
      const updated = { ...localCompany, logo };
      setLocalCompany(updated);
      setCompanyInfo(updated);
    } catch (err) {
      alert('Gagal memproses logo: ' + err.message);
    }
  };

  const handleAddPkg = () => {
    if(newPkgName && newPkgPrice) {
      onAddPackage(newPkgName, newPkgPrice);
      setNewPkgName('');
      setNewPkgPrice('');
    }
  };

  const isConnected = btDevice && btDevice.gatt.connected;

  return (
    <div className="pb-32 bg-gray-50 min-h-screen animate-in fade-in duration-300">
      {/* New Gradient Header */}
      <div className="px-5 pt-6 pb-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-b-[1.75rem] shadow-lg mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 shrink-0">
            <SlidersHorizontal size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight">Pengaturan</h1>
            <p className="text-blue-100 text-[11px] font-medium truncate">{isSuper ? 'Super Admin' : 'Admin'} · {currentUser?.email || 'KAsir'}</p>
          </div>
        </div>
      </div>

      {/* Tab per kategori pengaturan, biar tidak satu halaman panjang bergulir */}
      {TABS.length > 1 && (
        <div className="px-4 mb-5">
          <div className="grid gap-1 p-1 bg-gray-100 rounded-2xl" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all ${active ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 space-y-6">
        {activeTab === 'umum' && (
        <>
        {/* Section: Koneksi Hardware */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Koneksi Hardware</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  <Printer size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Printer Bluetooth</p>
                  <p className={`text-[10px] font-bold uppercase ${isConnected ? 'text-green-500' : 'text-gray-400'}`}>
                    {isConnected ? `Terhubung: ${btDevice.name}` : (savedDeviceName ? 'Tersimpan (Terputus)' : 'Belum Dipasangkan')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!isConnected && savedDeviceName && (
                  <button onClick={reconnectBluetooth} disabled={isConnecting} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg active:scale-95 transition-all">Sambung</button>
                )}
                <button onClick={isConnected ? disconnectBluetooth : connectBluetooth} disabled={isConnecting} className={`text-[10px] font-bold px-3 py-2 rounded-lg active:scale-95 transition-all ${isConnected ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'}`}>
                  {isConnecting ? '...' : (isConnected ? 'Putus' : 'Cari')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: PWA Install (Conditional) */}
        {deferredPrompt && (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-2">
                <Printer size={22}/> Instal Aplikasi KAsir
              </h3>
              <p className="text-xs opacity-90 mb-5 leading-relaxed">Instal aplikasi untuk akses instan dan fitur printer yang lebih stabil.</p>
              <button onClick={onInstall} className="w-full bg-white text-indigo-600 font-black py-3 rounded-lg shadow-md active:scale-95 transition-all">Pasang Sekarang</button>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        )}

        {/* Section: Profil Admin */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Profil & Akun Pengguna</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            
            {/* Akun Yang Sedang Login */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isSuper ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-sm' : 'bg-blue-600 shadow-sm'}`}>
                  {isSuper ? <Crown size={18} /> : <ShieldCheck size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">{myFullName || (isSuper ? 'Super Administrator' : 'Admin Kasir')}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isSuper ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isSuper ? 'Super Admin' : 'Admin'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">{currentUser?.email || 'admin@kasir.com'}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleLogout} 
                className="text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Ganti Akun
              </button>
            </div>

            {/* Nama akun ini SENDIRI — tiap admin/superadmin punya namanya masing-masing, bukan satu nama bersama.
                Ini yang tampil di header di atas dan sebagai nama kasir di struk transaksi akun ini. */}
            <div className="flex items-center gap-4 pt-1">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <User size={24} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Nama Saya (tampil di header & struk)</label>
                <input
                  name="myName"
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  onBlur={saveMyName}
                  disabled={savingMyName}
                  type="text"
                  placeholder="Nama Anda"
                  className="font-bold text-gray-800 bg-transparent border-none p-0 w-full outline-none text-base disabled:opacity-60"
                />
                {myNameError && <p className="text-[10px] text-red-600 font-semibold mt-0.5">{myNameError}</p>}
              </div>
            </div>

            {isSuper && (
              <div className="flex items-center gap-4 pt-1">
                <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Nama Kasir Default (Toko)</label>
                  <input
                    name="adminName"
                    value={localCompany.adminName || ''}
                    onChange={handleLocalChange}
                    onBlur={handleBlur}
                    type="text"
                    placeholder="Nama Admin / Kasir"
                    className="font-bold text-gray-800 bg-transparent border-none p-0 w-full outline-none text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Dipakai hanya kalau seorang admin belum mengatur namanya sendiri di atas.</p>
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Fee per Transaksi</p>
                <div className="flex items-center gap-1">
                  <span className="font-black text-emerald-600">Rp</span>
                  <input 
                    name="adminFee" 
                    readOnly={!isSuper}
                    value={localCompany.adminFee || ''} 
                    onChange={handleLocalChange} 
                    onBlur={handleBlur} 
                    type="number" 
                    className="font-black text-emerald-600 bg-transparent border-none p-0 w-24 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Tab: Toko & Paket (khusus superadmin) */}
        {isSuper && activeTab === 'toko' && (
        <>
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Identitas Toko</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama Usaha</label>
              <input 
                name="name" 
                value={localCompany.name || ''} 
                onChange={handleLocalChange} 
                onBlur={handleBlur} 
                type="text" 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Alamat Lengkap</label>
              <textarea 
                name="address" 
                value={localCompany.address || ''} 
                onChange={handleLocalChange} 
                onBlur={handleBlur} 
                rows="2"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">No. Telepon / WA</label>
              <input 
                name="phone" 
                value={localCompany.phone || ''} 
                onChange={handleLocalChange} 
                onBlur={handleBlur} 
                type="text" 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200 overflow-hidden">
                {companyInfo.logo ? (
                   <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                   <Image size={20} className="text-gray-400" />
                )}
              </div>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <button className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">Ganti Logo Toko</button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Manajemen Paket */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Paket Internet</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="space-y-3">
              {packages.map(pkg => (
                <div key={pkg.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{pkg.name}</p>
                    <p className="text-xs text-blue-600 font-bold">{formatRupiah(pkg.price)}</p>
                  </div>
                  <button onClick={() => onDeletePackage(pkg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
              <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Tambah Paket Baru</h4>
              <input value={newPkgName} onChange={(e)=>setNewPkgName(e.target.value)} type="text" placeholder="Nama Paket" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm font-medium"/>
              <input value={newPkgPrice} onChange={(e)=>setNewPkgPrice(e.target.value)} type="number" placeholder="Harga Paket" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm font-medium"/>
              <button onClick={handleAddPkg} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-sm shadow-md shadow-blue-200 active:scale-95 transition-all">Simpan Paket</button>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Tab: E-Billing (khusus superadmin) */}
        {isSuper && activeTab === 'ebilling' && (
        <>
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-1.5">
            <Activity size={14} className="text-blue-600" /> Integrasi E-Billing Monitoring System
          </h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">

            {/* Live Ping Heartbeat Status */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 p-4 rounded-xl text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </div>
                <div>
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400 fill-amber-400" /> Status Ping Live E-Billing
                  </p>
                  <p className="text-[11px] text-blue-200">
                    {livePingStatus ? livePingStatus.message : 'Memulai pengujian ping otomatis...'}
                  </p>
                </div>
              </div>
              {livePingStatus?.latencyMs && (
                <div className="text-right shrink-0">
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-1 rounded-md border border-emerald-500/30">
                    {livePingStatus.latencyMs}ms
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-800">Automasi Pengiriman Data</p>
                <p className="text-xs text-gray-400">Kirim data pembayaran lunas secara otomatis ke E-Billing</p>
              </div>
              <ToggleSwitch
                label="Automasi pengiriman data E-Billing"
                checked={localCompany.apiMonitoringEnabled || false}
                onChange={(checked) => {
                  const updated = { ...localCompany, apiMonitoringEnabled: checked };
                  setLocalCompany(updated);
                  setCompanyInfo(updated);
                  localStorage.setItem('api_monitoring_enabled', checked ? 'true' : 'false');
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">API Key Monitoring (E-Billing)</label>
                {localCompany.apiMonitoringKey && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck size={12} /> Terpasang & Aktif
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Key size={16} />
                </div>
                <input 
                  name="apiMonitoringKey" 
                  value={localCompany.apiMonitoringKey || ''} 
                  onChange={(e) => {
                    handleLocalChange(e);
                    localStorage.setItem('api_monitoring_key', e.target.value);
                  }} 
                  onBlur={() => {
                    handleBlur();
                    if (localCompany.apiMonitoringKey) {
                      localStorage.setItem('api_monitoring_key', localCompany.apiMonitoringKey);
                    }
                  }} 
                  type={showApiKey ? 'text' : 'password'} 
                  placeholder="Masukkan API Key Aplikasi Monitoring"
                  className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-blue-500 transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => setShowApiKey(!showApiKey)} 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button 
                type="button"
                onClick={() => {
                  if (localCompany.apiMonitoringKey) {
                    localStorage.setItem('api_monitoring_key', localCompany.apiMonitoringKey);
                  }
                  if (localCompany.apiMonitoringEnabled !== undefined) {
                    localStorage.setItem('api_monitoring_enabled', localCompany.apiMonitoringEnabled ? 'true' : 'false');
                  }
                  setCompanyInfo(localCompany);
                  setTestApiResult({ 
                    success: true, 
                    message: 'API Key Berhasil Disimpan Permanen!',
                    status: 'TERSIMPAN & AKTIF',
                    responseBody: `Token (${localCompany.apiMonitoringKey ? localCompany.apiMonitoringKey.substring(0, 4) + '...' : ''}) siap digunakan.`
                  });
                }} 
                className="w-full py-3 px-4 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-100"
              >
                <Key size={16} /> Simpan API Key Permanen
              </button>

              <button 
                type="button"
                onClick={handleTestApi} 
                disabled={isTestingApi}
                className="w-full py-3 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isTestingApi ? (
                  <>
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    Menguji Ping Server...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Tes Ping API Sekarang
                  </>
                )}
              </button>

              {onSyncEbilling && (
                <button 
                  type="button"
                  onClick={async () => {
                    setIsSyncingCust(true);
                    setSyncCustResult(null);
                    const res = await onSyncEbilling();
                    setSyncCustResult(res);
                    setIsSyncingCust(false);
                  }} 
                  disabled={isSyncingCust}
                  className="w-full py-3 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 border border-indigo-100"
                >
                  <RefreshCw size={16} className={isSyncingCust ? "animate-spin text-indigo-600" : "text-indigo-600"} />
                  {isSyncingCust ? 'Sedang Menarik Pelanggan E-Billing...' : 'Tarik Data Pelanggan dari E-Billing'}
                </button>
              )}

              {syncCustResult && (
                <div className={`p-3.5 rounded-xl text-xs font-medium space-y-1.5 ${syncCustResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {syncCustResult.success ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <XCircle size={16} className="shrink-0 text-red-600" />}
                    <span>{syncCustResult.message}</span>
                  </div>
                </div>
              )}

              {testApiResult && (
                <div className={`p-3.5 rounded-xl text-xs font-medium space-y-1.5 ${testApiResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {testApiResult.success ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <XCircle size={16} className="shrink-0 text-red-600" />}
                    <span>{testApiResult.message}</span>
                  </div>
                  {testApiResult.status && (
                    <div className="text-[11px] opacity-90 pl-6 flex flex-wrap gap-2">
                      <span className="bg-white/80 px-2 py-0.5 rounded font-mono font-bold">{testApiResult.status}</span>
                      {testApiResult.responseBody && <span className="italic truncate">{testApiResult.responseBody}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Riwayat Log Pengiriman E-Billing */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-blue-600" />
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Log Pengiriman Kasir ke E-Billing</h4>
                </div>
                {ebillingLogs.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => {
                      if (window.confirm('Bersihkan semua riwayat log pengiriman E-Billing?')) {
                        clearEbillingLogs();
                        setEbillingLogs([]);
                      }
                    }} 
                    className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                  >
                    Hapus Log
                  </button>
                )}
              </div>

              {ebillingLogs.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {ebillingLogs.map(log => (
                    <div key={log.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-blue-700">{log.customer_name}</span>
                        <span className="font-mono text-gray-400 text-[10px]">{log.dateFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">Kasir: <strong className="text-gray-800">{log.cashier_name}</strong> ({formatRupiah(log.price)})</span>
                        <span className="bg-emerald-100 text-emerald-700 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} /> {log.response_code}
                        </span>
                      </div>
                      {log.message && (
                        <p className="text-[10px] text-gray-500 italic border-t border-gray-100/60 pt-1 mt-1 truncate">
                          {log.message} • Token: {log.api_key_used}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400 italic">
                  Belum ada log pengiriman. Log akan otomatis tercatat setiap kali kasir menyelesaikan transaksi.
                </div>
              )}
            </div>

          </div>
        </div>
        </>
        )}

        {isSuper && activeTab === 'watbiz' && (
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-1.5">
            <MessageCircle size={14} className="text-emerald-600" /> Integrasi WhatsApp (Watbiz)
          </h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-800">Aktifkan Integrasi WhatsApp</p>
                <p className="text-xs text-gray-400">Dipakai untuk kirim reminder tagihan / invoice lewat Watbiz</p>
              </div>
              <ToggleSwitch
                label="Integrasi Watbiz"
                checked={localCompany.watbizEnabled || false}
                onChange={(checked) => {
                  const updated = { ...localCompany, watbizEnabled: checked };
                  setLocalCompany(updated);
                  setCompanyInfo(updated);
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Token API Watbiz</label>
                {localCompany.watbizToken && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck size={12} /> Terpasang
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Key size={16} />
                </div>
                <input
                  name="watbizToken"
                  value={localCompany.watbizToken || ''}
                  onChange={handleLocalChange}
                  onBlur={handleBlur}
                  type={showWatbizToken ? 'text' : 'password'}
                  placeholder="Token dari dashboard app.watbiz.com"
                  className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowWatbizToken(!showWatbizToken)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showWatbizToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Ambil dari dashboard Watbiz Anda, lalu tempel di sini. Tersimpan otomatis saat pindah kolom.</p>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Nomor WhatsApp Tujuan Tes</label>
              <input
                value={watbizTestNumber}
                onChange={(e) => setWatbizTestNumber(e.target.value)}
                type="text"
                placeholder="Contoh: 628123456789 (nomor Anda sendiri)"
                className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium mb-2"
              />
              <button
                type="button"
                onClick={handleTestWatbiz}
                disabled={isTestingWatbiz}
                className="w-full py-3 px-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 border border-emerald-100"
              >
                {isTestingWatbiz ? (
                  <>
                    <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                    Mengirim Pesan Tes...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Test Ping — Kirim Pesan Tes
                  </>
                )}
              </button>

              {watbizTestResult && (
                <div className={`mt-3 p-3.5 rounded-xl text-xs font-medium space-y-1.5 ${watbizTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {watbizTestResult.success ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <XCircle size={16} className="shrink-0 text-red-600" />}
                    <span>{watbizTestResult.message}</span>
                  </div>
                  {watbizTestResult.detail && <p className="text-[10px] opacity-70 pl-6 truncate">{watbizTestResult.detail}</p>}
                </div>
              )}
            </div>

            {/* Riwayat Pesan WhatsApp */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-emerald-600" />
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Riwayat WhatsApp</h4>
                </div>
                {watbizLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('Bersihkan semua riwayat pesan WhatsApp?')) return;
                      await supabase.from('watbiz_logs').delete().neq('id', 0);
                      loadWatbizLogs();
                    }}
                    className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                  >
                    Hapus Log
                  </button>
                )}
              </div>

              {watbizLogs.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {watbizLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-700">{log.phone_number}</span>
                        <span className="font-mono text-gray-400 text-[10px]">{new Date(log.sent_at).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-gray-600 font-medium truncate flex-1">{log.message}</span>
                        <span className={`shrink-0 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {log.status === 'success' ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {log.status === 'success' ? 'Sukses' : 'Gagal'}
                        </span>
                      </div>
                      {(log.sender_name || log.kind) && (
                        <p className="text-[10px] text-gray-400 italic border-t border-gray-100/60 pt-1 mt-1">
                          {log.kind === 'test' ? 'Tes koneksi' : log.kind} {log.sender_name ? `• oleh ${log.sender_name}` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400 italic">
                  Belum ada pesan terkirim. Riwayat otomatis tercatat setiap kali Test Ping / reminder dikirim.
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Tab: Akun Admin (khusus superadmin) */}
        {isSuper && activeTab === 'admin' && <AdminAccountsPanel />}

        {/* Tab: Runsnet (khusus superadmin) */}
        {isSuper && activeTab === 'runsnet' && <RunsnetSyncPanel session={session} />}

        {/* Danger Zone */}
        <div className="pt-4">
          <button onClick={handleLogout} className="w-full p-4 rounded-xl border border-red-100 text-red-500 text-xs font-black flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
            <LogOut size={16} /> KELUAR DARI APLIKASI
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
