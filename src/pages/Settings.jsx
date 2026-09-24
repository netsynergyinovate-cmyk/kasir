import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Wifi, Trash2, Bluetooth, BluetoothConnected,
  BluetoothOff, AlertCircle, AlertTriangle, Printer, User, LogOut, Image, ChevronRight,
  Key, Globe, Eye, EyeOff, Activity, CheckCircle2, XCircle, Send,
  Zap, Clock, RefreshCw, Server, ShieldCheck, Crown, SlidersHorizontal, Users, MessageCircle,
  Copy, Check, Webhook, ExternalLink, ZoomIn, X, ChevronDown, ChevronUp, FileText,
  ImagePlus, Loader2
} from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { supabase } from '../lib/supabase';
import { testBillingSystemConnection, getEbillingLogs, clearEbillingLogs } from '../utils/billingApi';
import AdminAccountsPanel from '../components/AdminAccountsPanel';
import RunsnetSyncPanel from '../components/RunsnetSyncPanel';
import ToggleSwitch from '../components/ToggleSwitch';
import { resizeImageFile } from '../utils/imageResize';
import { MAP_ICON_TYPES, MAP_ICON_COLORS, getDeterministicColor, getInitials } from '../utils/adminMapIcons';
import { normalizeAdminAccess } from '../utils/permissions';

const parseLogDetail = (detail) => {
  if (!detail) return {};
  if (typeof detail === 'object') return detail;
  try {
    return JSON.parse(detail);
  } catch {
    return { raw: String(detail) };
  }
};

const Settings = ({ 
  packages, onAddPackage, onDeletePackage, companyInfo, setCompanyInfo, 
  btDevice, isConnecting, connectBluetooth, disconnectBluetooth, reconnectBluetooth, savedDeviceName,
  deferredPrompt, onInstall, onSyncEbilling, onUpdateMyName, session,
  customers = [], transactions = []
}) => {
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [myName, setMyName] = useState('');
  const [savingMyName, setSavingMyName] = useState(false);
  const [myNameError, setMyNameError] = useState(null);

  // Kustomisasi Icon Map Akun Sendiri
  const myAccess = normalizeAdminAccess(session?.profile?.allowed_paths);
  const myIconConfig = myAccess.map_icon || {};
  const [myIconType, setMyIconType] = useState(myIconConfig.type || (session?.profile?.role === 'superadmin' ? 'crown' : 'motor'));
  const [myIconColor, setMyIconColor] = useState(myIconConfig.color || getDeterministicColor(session?.user?.id || session?.profile?.full_name || 'Admin'));
  const [myIconLabel, setMyIconLabel] = useState(myIconConfig.label || getInitials(session?.profile?.full_name || 'Admin'));
  const [savingMyIcon, setSavingMyIcon] = useState(false);
  const [myIconSaved, setMyIconSaved] = useState(false);

  useEffect(() => {
    if (session?.profile?.allowed_paths) {
      const acc = normalizeAdminAccess(session.profile.allowed_paths);
      if (acc.map_icon) {
        if (acc.map_icon.type) setMyIconType(acc.map_icon.type);
        if (acc.map_icon.color) setMyIconColor(acc.map_icon.color);
        if (acc.map_icon.label) setMyIconLabel(acc.map_icon.label);
      }
    }
  }, [session?.profile?.allowed_paths]);

  const saveMyMapIcon = async () => {
    if (!session?.user?.id) return;
    setSavingMyIcon(true);
    setMyIconSaved(false);
    try {
      const current = normalizeAdminAccess(session?.profile?.allowed_paths);
      const updated = {
        ...current,
        map_icon: {
          type: myIconType,
          color: myIconColor,
          label: (myIconLabel || getInitials(myName || 'Admin')).substring(0, 3).toUpperCase(),
        },
      };

      const { error } = await supabase
        .from('admin_profiles')
        .update({ allowed_paths: updated })
        .eq('id', session.user.id);

      if (error) throw error;
      setMyIconSaved(true);
      setTimeout(() => setMyIconSaved(false), 2500);
    } catch (err) {
      alert('Gagal menyimpan icon peta: ' + err.message);
    } finally {
      setSavingMyIcon(false);
    }
  };

  const [localCompany, setLocalCompany] = useState(() => ({
    ...companyInfo,
    watbizToken: companyInfo?.watbizToken || (typeof window !== 'undefined' ? localStorage.getItem('watbiz_token') : '') || '51dad347-d267-4254-9858-3e3b19c76c53',
    watbizEnabled: companyInfo?.watbizEnabled ?? (typeof window !== 'undefined' ? localStorage.getItem('watbiz_enabled') !== 'false' : true),
  }));

  useEffect(() => {
    if (companyInfo) {
      setLocalCompany((prev) => ({
        ...prev,
        ...companyInfo,
        watbizToken: companyInfo.watbizToken || prev.watbizToken || (typeof window !== 'undefined' ? localStorage.getItem('watbiz_token') : '') || '51dad347-d267-4254-9858-3e3b19c76c53',
        watbizEnabled: companyInfo.watbizEnabled ?? prev.watbizEnabled ?? true,
      }));
    }
  }, [companyInfo]);

  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isSyncingCust, setIsSyncingCust] = useState(false);
  const [syncCustResult, setSyncCustResult] = useState(null);
  const [testApiResult, setTestApiResult] = useState(null);
  const [ebillingLogs, setEbillingLogs] = useState([]);
  const [livePingStatus, setLivePingStatus] = useState(null);
  const [showWatbizToken, setShowWatbizToken] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem('kasir_settings_tab') || 'umum';
  });

  useEffect(() => {
    try { localStorage.setItem('kasir_settings_tab', activeTab); } catch {}
    setSearchParams((prev) => {
      const currentVal = prev.get('tab') || '';
      const targetVal = activeTab && activeTab !== 'umum' ? activeTab : '';
      if (currentVal === targetVal) return prev;
      const next = new URLSearchParams(prev);
      if (!targetVal) next.delete('tab');
      else next.set('tab', targetVal);
      return next;
    }, { replace: true });
  }, [activeTab]);
  const [watbizTestNumber, setWatbizTestNumber] = useState('');
  const [isTestingWatbiz, setIsTestingWatbiz] = useState(false);
  const [watbizTestResult, setWatbizTestResult] = useState(null);
  const [watbizLogs, setWatbizLogs] = useState([]);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [registerWebhookResult, setRegisterWebhookResult] = useState(null);
  const [registeredWebhookUrl, setRegisteredWebhookUrl] = useState(null);
  const [isLoadingWebhookStatus, setIsLoadingWebhookStatus] = useState(false);

  // Simulasi Webhook Lokal (Auto-payment test langsung dari localhost)
  const [simCustomerPhone, setSimCustomerPhone] = useState('');
  const [simType, setSimType] = useState('photo'); // 'photo' | 'text'
  const [simProofFile, setSimProofFile] = useState(null);
  const [simProofPreview, setSimProofPreview] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const defaultWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/watbiz` : '';
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.')
  );

  const [webhookUrlInput, setWebhookUrlInput] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('kasir_watbiz_webhook_url') : '';
    // Jika tersimpan localhost tapi sekarang diakses di domain publik hasil deploy, otomatis gunakan domain publik aktif
    const isPublic = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (saved && (saved.includes('localhost') || saved.includes('127.0.0.1')) && isPublic) {
      return defaultWebhookUrl;
    }
    return saved || defaultWebhookUrl;
  });

  // Otomatis ganti ke domain publik jika berpindah dari localhost ke deploy publik
  useEffect(() => {
    if (!isLocalhost && webhookUrlInput && (webhookUrlInput.includes('localhost') || webhookUrlInput.includes('127.0.0.1'))) {
      setWebhookUrlInput(defaultWebhookUrl);
      localStorage.setItem('kasir_watbiz_webhook_url', defaultWebhookUrl);
    }
  }, [isLocalhost, defaultWebhookUrl, webhookUrlInput]);

  const [logFilter, setLogFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const loadWatbizLogs = async (showLoading = false) => {
    if (showLoading) setIsLoadingLogs(true);
    try {
      const query = supabase.from('watbiz_logs').select('*');
      const res = typeof query?.order === 'function'
        ? await query.order('sent_at', { ascending: false }).limit(60)
        : await query;
      if (res?.data) setWatbizLogs(res.data);
    } catch (err) {
      console.warn('Gagal memuat watbiz_logs:', err);
    } finally {
      if (showLoading) setIsLoadingLogs(false);
    }
  };

  const handleUploadRealProof = async (e, log) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const resized = await resizeImageFile(file, 1000, { type: 'image/jpeg', quality: 0.85 });
      const detail = parseLogDetail(log.response_detail);
      detail.mediaUrl = resized;
      detail.needsPhotoAttachment = false;

      // 1. Cari transactionId jika belum ada di log
      let trxId = detail.transactionId;
      if (!trxId) {
        const custName = detail.customerName || log.sender_name;
        if (custName) {
          const { data: matchedTrx } = await supabase.from('transactions')
            .select('id, invoice_number, price')
            .ilike('customer_name', `%${custName.trim()}%`)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (matchedTrx?.id) {
            trxId = matchedTrx.id;
            detail.transactionId = trxId;
            if (!detail.invoice) detail.invoice = matchedTrx.invoice_number;
            if (!detail.nominal) detail.nominal = matchedTrx.price;
          }
        }
      }

      // 2. Simpan foto asli ke watbiz_logs
      await supabase.from('watbiz_logs').update({
        response_detail: JSON.stringify(detail)
      }).eq('id', log.id);

      // 3. Jika ada transaksi terkait, simpan ke runsnet_proofs
      if (trxId) {
        await supabase.from('runsnet_proofs').upsert({
          transaction_id: trxId,
          image: resized,
          uploaded_by_name: session?.profile?.full_name || 'Admin WhatsApp',
          created_at: new Date().toISOString()
        }, { onConflict: 'transaction_id' });
      }

      window.dispatchEvent(new CustomEvent('kasir:proof-updated', { detail: { transactionId: trxId } }));
      await loadWatbizLogs(true);
      alert('Foto bukti asli dari WhatsApp pelanggan berhasil disimpan ke database!');
    } catch (err) {
      alert('Gagal mengunggah foto bukti: ' + err.message);
    }
  };

  const fetchRegisteredWebhook = async () => {
    if (!session?.access_token) return;
    setIsLoadingWebhookStatus(true);
    try {
      const res = await fetch('/api/watbiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'get-webhook' }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRegisteredWebhookUrl(data.webhookUrl || null);
      }
    } catch {}
    setIsLoadingWebhookStatus(false);
  };

  useEffect(() => {
    if (activeTab === 'watbiz') {
      loadWatbizLogs(true);
      fetchRegisteredWebhook();
      const interval = setInterval(() => {
        loadWatbizLogs(false);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);


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
      const response = await fetch('/api/watbiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ action: 'ping', token: localCompany.watbizToken, to: watbizTestNumber.trim(), senderName: myFullName || null }),
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

  // Mendaftarkan Webhook URL otomatis ke sistem Watbiz via API v2 (POST /api/v2/webhook)
  const handleRegisterWebhook = async () => {
    if (!localCompany.watbizToken) {
      setRegisterWebhookResult({ success: false, message: 'Isi token API Watbiz terlebih dahulu.' });
      return;
    }
    const targetUrl = (webhookUrlInput || '').trim() || defaultWebhookUrl;
    if (!targetUrl) {
      setRegisterWebhookResult({ success: false, message: 'URL Webhook wajib diisi.' });
      return;
    }

    if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
      const proceed = window.confirm(
        '⚠️ Perhatian: URL mengarah ke LOCALHOST. Server Watbiz di cloud internet tidak dapat mengirim webhook ke komputer lokal Anda tanpa tunnel (seperti ngrok/Cloudflare) atau domain publik hasil deploy.\n\nTetap lanjutkan mendaftarkan URL ini?'
      );
      if (!proceed) return;
    }

    setIsRegisteringWebhook(true);
    setRegisterWebhookResult(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch('/api/watbiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({
          action: 'register-webhook',
          token: localCompany.watbizToken,
          webhookUrl: targetUrl
        }),
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        localStorage.setItem('kasir_watbiz_webhook_url', targetUrl);
        setRegisteredWebhookUrl(targetUrl);
        setRegisterWebhookResult({
          success: true,
          message: `Webhook berhasil didaftarkan ke Watbiz API! (${targetUrl})`,
          detail: typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
        });
      } else {
        setRegisterWebhookResult({
          success: false,
          message: result.error || result.body?.message || 'Watbiz menolak pendaftaran webhook.',
          detail: JSON.stringify(result.body || result)
        });
      }
      loadWatbizLogs();
    } catch (err) {
      setRegisterWebhookResult({ success: false, message: 'Gagal menghubungi server: ' + err.message });
    }
    setIsRegisteringWebhook(false);
  };

  // Uji Simulasi Webhook Lokal (Auto-payment test langsung dari localhost tanpa tunnel)
  const handleSimulateWebhook = async () => {
    const targetPhone = simCustomerPhone.trim();
    if (!targetPhone) {
      setSimResult({ success: false, message: 'Pilih pelanggan atau masukkan nomor WhatsApp terlebih dahulu.' });
      return;
    }
    setIsSimulating(true);
    setSimResult(null);
    try {
      const payload = {
        action: 'webhook',
        phone: targetPhone,
        message: simType === 'photo' 
          ? 'Halo admin, saya sudah transfer pembayaran internet bulanan. Mohon dicek ya 🙏' 
          : 'Halo admin kasir, tagihan internet saya sudah lunas dibayar via transfer',
        media_url: simType === 'photo' ? (simProofFile || null) : null,
        type: simType === 'photo' ? 'image' : 'text',
      };

      const response = await fetch('/api/watbiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok && result.ok) {
        if (result.status === 'proof_photo_required') {
          setSimResult({
            success: true,
            status: result.status,
            isProofRequired: true,
            message: `Verifikasi Ketat Berhasil (Pembayaran Ditolak): Pesan teks dari ${result.customer || targetPhone} tidak menyertakan foto struk. Bot WhatsApp otomatis membalas meminta kirim foto bukti transfer dan kasir TIDAK mencatat pembayaran.`,
            transaction: null,
            replySent: result.replySent,
          });
        } else {
          setSimResult({
            success: true,
            status: result.status,
            isProofRequired: false,
            message: `Simulasi Auto-Payment Berhasil: Bukti foto struk diverifikasi, transaksi LUNAS dicatat untuk ${result.customer || targetPhone}, status pelanggan AKTIF, dan pesan konfirmasi WhatsApp terkirim!`,
            transaction: result.transaction,
            replySent: result.replySent,
          });

          // Beritahu App.jsx agar daftar transaksi & status pelanggan langsung ter-update di UI tanpa perlu refresh
          if (result.transaction) {
            window.dispatchEvent(new CustomEvent('kasir:auto-payment-success', {
              detail: { transaction: result.transaction, customerName: result.customer }
            }));
          }
        }
      } else {
        setSimResult({
          success: false,
          message: result.error || 'Simulasi ditolak server lokal.',
          detail: typeof result === 'object' ? JSON.stringify(result) : String(result),
        });
      }
      loadWatbizLogs();
    } catch (err) {
      setSimResult({ success: false, message: 'Gagal menghubungi server lokal: ' + err.message });
    } finally {
      setIsSimulating(false);
    }
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

            {/* Custom Icon & Marker Peta Saya (Live Preview) */}
            <div className="pt-4 border-t border-gray-100 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Icon & Marker Peta Saya</p>
                  <p className="text-[11px] text-gray-500">Tampilan pin unik akun Anda di peta rute kunjungan</p>
                </div>
                {myIconSaved && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> Tersimpan
                  </span>
                )}
              </div>

              {/* Live Preview Card */}
              <div className="p-4 bg-gradient-to-b from-slate-50 to-slate-100/60 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col items-center">
                  <div className="relative flex flex-col items-center" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))' }}>
                    <div style={{ position: 'relative', width: 44, height: 44, borderRadius: '9999px', background: myIconColor, border: '3px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }}>
                      <span dangerouslySetInnerHTML={{ __html: (MAP_ICON_TYPES.find(t => t.id === myIconType) || MAP_ICON_TYPES[0]).svg.replace('width="18"', 'width="22"').replace('height="18"', 'height="22"') }} />
                      <div style={{ position: 'absolute', top: -5, right: -5, background: '#ffffff', color: myIconColor, fontSize: 10, fontWeight: 900, padding: '1px 3.5px', borderRadius: '9999px', border: `1.5px solid ${myIconColor}`, lineHeight: 1 }}>
                        {myIconLabel || getInitials(myName || 'Saya')}
                      </div>
                    </div>
                    <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${myIconColor}`, marginTop: -1.5 }} />
                    <div className="mt-1 bg-slate-900/85 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap shadow-xs">
                      {myName || 'Saya'}
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 italic">Pratinjau Marker di Peta</span>
                </div>

                <div className="flex-1 w-full space-y-2.5">
                  {/* Pilihan Jenis */}
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase">Jenis Icon:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 mt-1">
                      {MAP_ICON_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setMyIconType(t.id)}
                          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border text-[9px] font-bold transition-all ${myIconType === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs' : 'border-gray-200 text-gray-500 hover:bg-white'}`}
                        >
                          <span className="text-base">{t.iconText}</span>
                          <span className="text-[8px] truncate">{t.label.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pilihan Warna */}
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase">Warna Tema:</span>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {MAP_ICON_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setMyIconColor(c.value)}
                          className={`w-7 h-7 rounded-lg border-2 transition-all ${myIconColor === c.value ? 'border-gray-900 scale-110 ring-2 ring-offset-1 ring-gray-300' : 'border-transparent hover:scale-105'}`}
                          style={{ background: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Inisial & Tombol Simpan */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="w-20">
                      <input
                        type="text"
                        maxLength={3}
                        value={myIconLabel}
                        onChange={(e) => setMyIconLabel(e.target.value.toUpperCase())}
                        placeholder="Inisial"
                        className="w-full p-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-black text-center uppercase"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveMyMapIcon}
                      disabled={savingMyIcon}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 shadow-sm"
                    >
                      {savingMyIcon ? <Loader2 size={13} className="animate-spin" /> : myIconSaved ? <CheckCircle2 size={13} /> : null}
                      {savingMyIcon ? 'Menyimpan...' : myIconSaved ? 'Tersimpan!' : 'Simpan Icon Peta'}
                    </button>
                  </div>
                </div>
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

        {/* Section: Keamanan */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Keamanan</h2>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-800">Kunci Otomatis 15 Menit — Kecualikan Superadmin</p>
                <p className="text-xs text-gray-400 mt-0.5">Aktifkan sementara saat sedang develop/testing supaya akun superadmin tidak ikut terkunci. Akun admin tetap terkunci seperti biasa.</p>
              </div>
              <ToggleSwitch
                label="Kecualikan superadmin dari kunci otomatis"
                checked={localCompany.idleLockExemptSuperadmin || false}
                onChange={(checked) => {
                  const updated = { ...localCompany, idleLockExemptSuperadmin: checked };
                  setLocalCompany(updated);
                  setCompanyInfo(updated);
                }}
              />
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

            {/* Webhook Integrasi Watbiz */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                  <Webhook size={13} className="text-emerald-600" />
                  <span>Webhook URL (Auto-Payment & Auto-Konfirmasi)</span>
                </label>
                {isLocalhost ? (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    ⚠️ Mode Lokal (Localhost)
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    🌐 Domain Publik Aktif
                  </span>
                )}
              </div>

              {/* Status URL Webhook yang Terdaftar di Server Watbiz */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Status di Watbiz:</span>
                  {isLoadingWebhookStatus ? (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <RefreshCw size={11} className="animate-spin text-blue-600 shrink-0" />
                      <span>Memeriksa server Watbiz...</span>
                    </span>
                  ) : registeredWebhookUrl ? (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                      <span className="truncate" title={registeredWebhookUrl}>Terdaftar: {registeredWebhookUrl}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                      <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                      <span>Belum terdaftar di Watbiz</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchRegisteredWebhook}
                  disabled={isLoadingWebhookStatus}
                  className="shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Cek ulang status webhook dari Watbiz"
                >
                  <RefreshCw size={12} className={isLoadingWebhookStatus ? 'animate-spin' : ''} />
                </button>
              </div>


              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookUrlInput}
                    onChange={(e) => {
                      setWebhookUrlInput(e.target.value);
                      localStorage.setItem('kasir_watbiz_webhook_url', e.target.value);
                    }}
                    placeholder="https://domain-anda.vercel.app/api/watbiz"
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrlInput || defaultWebhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                  >
                    {copiedWebhook ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedWebhook ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>

                {webhookUrlInput !== defaultWebhookUrl && defaultWebhookUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setWebhookUrlInput(defaultWebhookUrl);
                      localStorage.setItem('kasir_watbiz_webhook_url', defaultWebhookUrl);
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1 ml-1"
                  >
                    <span>↺ Pasang domain aktif ini ({defaultWebhookUrl})</span>
                  </button>
                )}
              </div>

              {isLocalhost && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span>⚠️ Informasi Menjalankan di Lokal:</span>
                  </p>
                  <p className="leading-relaxed text-[10px]">
                    Server Watbiz di internet <strong>tidak bisa mengirim pesan ke localhost secara langsung</strong>. Agar webhook berfungsi:
                  </p>
                  <ul className="list-disc pl-4 text-[10px] space-y-0.5">
                    <li>Saat di lokal, Anda bisa menggunakan tunnel seperti <strong>ngrok</strong> (masukkan URL ngrok di atas).</li>
                    <li>Setelah <strong>deploy ke Vercel</strong>, buka aplikasi di URL Vercel Anda, dan klik tombol daftar di bawah. URL akan <strong>otomatis berganti ke domain Vercel Anda</strong>!</li>
                  </ul>
                </div>
              )}

              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={handleRegisterWebhook}
                  disabled={isRegisteringWebhook}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {isRegisteringWebhook ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Mendaftarkan Webhook ke Watbiz Server...</span>
                    </>
                  ) : (
                    <>
                      <Webhook size={14} />
                      <span>Daftarkan Webhook Otomatis ke Watbiz API</span>
                    </>
                  )}
                </button>

                {registerWebhookResult && (
                  <div className={`mt-2 p-3 rounded-xl text-xs font-medium space-y-1 ${registerWebhookResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    <div className="flex items-center gap-2 font-bold">
                      {registerWebhookResult.success ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> : <XCircle size={15} className="shrink-0 text-red-600" />}
                      <span>{registerWebhookResult.message}</span>
                    </div>
                    {registerWebhookResult.detail && <p className="text-[10px] opacity-75 pl-5 truncate font-mono">{registerWebhookResult.detail}</p>}
                  </div>
                )}
              </div>

              {/* Simulator Webhook Lokal (Auto-Payment & Auto-Konfirmasi) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Zap size={14} className="text-amber-500 fill-amber-500" />
                    <span>🧪 Uji Simulasi Webhook Lokal (Auto-Payment)</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                    {isLocalhost ? 'Mode Lokal Tanpa Tunnel' : 'Uji Langsung Server'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Coba alur pesan masuk WhatsApp dari pelanggan langsung di server kasir: sistem akan mendeteksi nomor pelanggan, mencatat transaksi lunas, membuka isolir (update status ke aktif), dan mengirim balasan bukti bayar.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Pilih Pelanggan Uji Coba:
                    </label>
                    <select
                      value={simCustomerPhone}
                      onChange={(e) => setSimCustomerPhone(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Pilih dari database ({customers?.length || 0} pelanggan) --</option>
                      {customers?.filter(c => c.phone)?.slice(0, 50)?.map(c => (
                        <option key={c.id} value={c.phone}>
                          {c.name} ({c.phone}) - {c.status || 'aktif'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Atau Ketik Nomor WhatsApp:
                    </label>
                    <input
                      type="text"
                      value={simCustomerPhone}
                      onChange={(e) => setSimCustomerPhone(e.target.value)}
                      placeholder="Contoh: 628123456789"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Skenario Masuk:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="simType"
                      value="photo"
                      checked={simType === 'photo'}
                      onChange={() => setSimType('photo')}
                      className="accent-emerald-600"
                    />
                    <span>📸 Foto Bukti Struk Transfer</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="simType"
                      value="text"
                      checked={simType === 'text'}
                      onChange={() => setSimType('text')}
                      className="accent-emerald-600"
                    />
                    <span>💬 Pesan Teks ("Sudah bayar kak")</span>
                  </label>
                </div>

                {simType === 'photo' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Lampirkan File Foto Struk Asli (Opsional untuk Pengujian):</span>
                      {simProofPreview && (
                        <button
                          type="button"
                          onClick={() => { setSimProofFile(null); setSimProofPreview(null); }}
                          className="text-[10px] text-red-600 hover:underline font-bold"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {simProofPreview ? (
                        <img src={simProofPreview} alt="Preview Foto Struk" className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shadow-xs" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-[10px] text-center font-bold p-1">
                          Foto Struk
                        </div>
                      )}
                      <label className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5">
                        <ImagePlus size={13} className="text-emerald-600" />
                        <span>{simProofPreview ? 'Ganti Foto Struk Asli' : 'Pilih Foto Struk Asli'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) {
                              const res = await resizeImageFile(f, 1000, { type: 'image/jpeg', quality: 0.85 });
                              setSimProofFile(res);
                              setSimProofPreview(res);
                            }
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Jika file foto struk dipilih, foto asli ini akan langsung dikirimkan ke webhook dan tersimpan permanen di database.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSimulateWebhook}
                  disabled={isSimulating}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {isSimulating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Menjalankan Simulasi Webhook Lokal...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>Jalankan Simulasi Webhook Lokal</span>
                    </>
                  )}
                </button>

                {simResult && (
                  <div className={`p-3 rounded-xl text-xs font-medium space-y-1.5 ${
                    !simResult.success
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : simResult.isProofRequired
                        ? 'bg-amber-50 text-amber-900 border border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {!simResult.success ? (
                        <XCircle size={16} className="shrink-0 text-red-600" />
                      ) : simResult.isProofRequired ? (
                        <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                      ) : (
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      )}
                      <span>{simResult.message}</span>
                    </div>
                    {simResult.transaction && (
                      <p className="text-[10px] text-emerald-700 pl-6 font-mono">
                        ✓ Transaksi ID: {simResult.transaction.id} | Jumlah: {formatRupiah(simResult.transaction.price || simResult.transaction.amount_paid)} | Status: {simResult.transaction.status}
                      </p>
                    )}
                    {simResult.isProofRequired && (
                      <p className="text-[10px] text-amber-800 pl-6 font-medium">
                        🛡️ Pengamanan Aktif: Pembayaran tidak akan diproses tanpa foto struk asli dari pelanggan. Bot membalas meminta foto bukti transfer.
                      </p>
                    )}
                    {simResult.detail && typeof simResult.detail === 'string' && (
                      <p className="text-[10px] opacity-75 pl-6 truncate font-mono">{simResult.detail}</p>
                    )}
                  </div>
                )}

              </div>

              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-[11px] text-emerald-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1 text-emerald-950">
                  <span>💡 Otomasi Webhook Aktif:</span>
                </p>
                <p className="leading-relaxed text-emerald-800 text-[11px]">
                  Pasang URL webhook di atas pada menu <strong>Webhook</strong> di dashboard Watbiz Anda:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-emerald-900 pt-1">
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-800 block">📸 Foto Bukti Transfer</span>
                    Pelanggan kirim foto transfer ➔ Sistem otomatis memproses LUNAS tanpa menunggu admin.
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-800 block">💬 Konfirmasi Teks</span>
                    Pelanggan ketik <em>"sudah bayar / lunas"</em> ➔ Bot otomatis verifikasi & kirim bukti.
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-800 block">⚡ Sinkron Runsnet</span>
                    Otomatis sinkron ke server Runsnet sehingga isolir terbuka langsung.
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-800 block">⏰ Pengingat Isolir H-2 / H-1</span>
                    Tagihan mendekati jatuh tempo otomatis diingatkan dengan peringatan isolir resmi.
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat & Log WhatsApp Gateway (Lengkap dengan Foto Bukti Klien & Detail Transaksi) */}
            <div className="pt-5 border-t border-gray-100 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Server size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                        Log & Riwayat WhatsApp Gateway
                      </h4>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Realtime Live
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Seluruh pesan, foto bukti pembayaran dari klien, dan auto-payment tercatat transparan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadWatbizLogs(true)}
                    disabled={isLoadingLogs}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="Segarkan data log WhatsApp"
                  >
                    <RefreshCw size={12} className={isLoadingLogs ? 'animate-spin text-emerald-600' : ''} />
                    <span>Segarkan</span>
                  </button>

                  {watbizLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Bersihkan semua riwayat pesan & log WhatsApp?')) return;
                        await supabase.from('watbiz_logs').delete().neq('id', 0);
                        loadWatbizLogs(true);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Hapus Log</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs Log */}
              {watbizLogs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setLogFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                      logFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({watbizLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('proof')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors ${
                      logFilter === 'proof'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <span>📸 Foto Bukti ({watbizLogs.filter((l) => l.kind === 'inbound_proof' || Boolean(parseLogDetail(l.response_detail).mediaUrl)).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('auto_payment')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors ${
                      logFilter === 'auto_payment'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    <span>⚡ Auto-Payment ({watbizLogs.filter((l) => l.kind === 'auto_payment').length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('invoice')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors ${
                      logFilter === 'invoice'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    <span>🧾 Struk Transaksi ({watbizLogs.filter((l) => l.kind === 'invoice').length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('request')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors ${
                      logFilter === 'request'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <span>🛡️ Minta Foto ({watbizLogs.filter((l) => l.kind === 'inbound_request_proof').length})</span>
                  </button>
                </div>
              )}

              {/* Daftar Log WhatsApp */}
              {watbizLogs.length > 0 ? (
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {watbizLogs
                    .filter((log) => {
                      const detail = parseLogDetail(log.response_detail);
                      const hasMedia = log.kind === 'inbound_proof' || Boolean(detail.mediaUrl);
                      if (logFilter === 'proof') return hasMedia;
                      if (logFilter === 'auto_payment') return log.kind === 'auto_payment';
                      if (logFilter === 'invoice') return log.kind === 'invoice';
                      if (logFilter === 'request') return log.kind === 'inbound_request_proof';
                      return true;
                    })
                    .map((log) => {
                      const detail = parseLogDetail(log.response_detail);
                      const mediaUrl = detail.mediaUrl || detail.image || detail.imageUrl || (
                        typeof log.message === 'string' && log.message.includes('http') && (log.message.includes('.jpg') || log.message.includes('.png') || log.message.includes('.jpeg'))
                          ? log.message.match(/https?:\/\/[^\s]+/)?.[0]
                          : null
                      );
                      const isExpanded = expandedLogId === log.id;

                      const kindBadge = {
                        inbound_proof: { text: '📸 Foto Bukti Masuk', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                        auto_payment: { text: '⚡ Auto-Payment Bot', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
                        invoice: { text: '🧾 Bukti Transaksi', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
                        reminder: { text: '⏰ Pengingat Tagihan', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
                        inbound_request_proof: { text: '🛡️ Minta Foto Struk', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
                        inbound: { text: '💬 Pesan Masuk WA', bg: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
                        test: { text: '🧪 Tes Koneksi', bg: 'bg-gray-100 text-gray-700 border-gray-200' }
                      }[log.kind] || { text: log.kind || 'WA', bg: 'bg-gray-100 text-gray-700 border-gray-200' };

                      return (
                        <div
                          key={log.id}
                          className={`p-3.5 bg-white border rounded-2xl shadow-xs transition-all space-y-2.5 ${
                            log.kind === 'inbound_proof' || mediaUrl
                              ? 'border-emerald-200 hover:border-emerald-300 ring-1 ring-emerald-50'
                              : log.kind === 'auto_payment'
                                ? 'border-purple-200 hover:border-purple-300 ring-1 ring-purple-50'
                                : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Header Bar Log */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                {log.phone_number}
                              </span>
                              {(detail.customerName || log.sender_name) && (
                                <span className="text-[11px] font-bold text-slate-700">
                                  👤 {detail.customerName || log.sender_name}
                                </span>
                              )}
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${kindBadge.bg}`}>
                                {kindBadge.text}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="font-mono">
                                {new Date(log.sent_at || log.created_at).toLocaleString('id-ID', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                                })} WIB
                              </span>
                              <span className={`font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                log.status === 'success' || log.status === 'received'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : log.status === 'payment_saved_wa_pending'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {log.status === 'success' || log.status === 'received' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                {log.status === 'received' ? 'Diterima' : log.status === 'success' ? 'Sukses' : log.status === 'payment_saved_wa_pending' ? 'Lunas (WA Pending)' : 'Gagal'}
                              </span>
                            </div>
                          </div>

                          {/* Isi Pesan WhatsApp */}
                          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                            {log.message}
                          </div>

                          {/* TAMPILAN FOTO / GAMBAR BUKTI PEMBAYARAN DARI KLIEN */}
                          {mediaUrl ? (
                            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-3">
                              <div
                                onClick={() => setPreviewImageModal({
                                  url: mediaUrl,
                                  title: `Foto Bukti Transfer: ${detail.customerName || log.phone_number}`,
                                  phone: log.phone_number,
                                  time: log.sent_at || log.created_at
                                })}
                                className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border border-emerald-300 bg-white shadow-xs hover:shadow-md transition-all w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center"
                                title="Klik untuk memperbesar foto bukti"
                              >
                                <img
                                  src={mediaUrl}
                                  alt="Foto Bukti Pembayaran"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.parentElement) {
                                      e.target.parentElement.innerHTML = '<div class="text-[9px] text-slate-400 p-2 text-center font-bold">Foto Bukti WhatsApp</div>';
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold gap-1">
                                  <ZoomIn size={13} />
                                  <span>Perbesar</span>
                                </div>
                              </div>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                                  <Image size={14} className="text-emerald-700 shrink-0" />
                                  <span>Foto Bukti Asli Pembayaran</span>
                                </div>
                                <p className="text-[11px] text-emerald-800 leading-snug">
                                  Foto fisik bukti transfer tersimpan permanen di database dan terhubung ke riwayat transaksi.
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImageModal({
                                      url: mediaUrl,
                                      title: `Foto Bukti Transfer: ${detail.customerName || log.phone_number}`,
                                      phone: log.phone_number,
                                      time: log.sent_at || log.created_at
                                    })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-xs transition-colors"
                                  >
                                    <ZoomIn size={11} />
                                    <span>Lihat Foto Penuh</span>
                                  </button>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 transition-colors"
                                  >
                                    <ExternalLink size={11} />
                                    <span>Buka di Tab Baru</span>
                                  </a>
                                  <label className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 cursor-pointer transition-colors">
                                    <ImagePlus size={11} />
                                    <span>Ganti Foto Asli</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleUploadRealProof(e, log)}
                                      className="sr-only"
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          ) : (log.kind === 'inbound_proof' || detail.isImage) && (
                            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                                  <Image size={14} className="text-amber-700 shrink-0" />
                                  <span>Foto Bukti Diterima di WhatsApp</span>
                                  {detail.whatsappMessageId && (
                                    <span className="font-mono text-[10px] text-amber-600 font-normal">
                                      (ID: {detail.whatsappMessageId.slice(0, 16)}...)
                                    </span>
                                  )}
                                </div>
                                <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all">
                                  <ImagePlus size={13} />
                                  <span>📎 Unggah Foto Asli dari WA</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleUploadRealProof(e, log)}
                                    className="sr-only"
                                  />
                                </label>
                              </div>
                              <p className="text-[11px] text-amber-800 leading-snug">
                                Pelanggan telah mengirim foto bukti pembayaran ke nomor WhatsApp Anda. Karena gateway Watbiz hanya mengirimkan notifikasi tanpa file gambar fisik, silakan klik <strong>Unggah Foto Asli dari WA</strong> untuk melampirkan file foto yang Anda terima di WhatsApp agar tersimpan permanen di database transaksi.
                              </p>
                            </div>
                          )}

                          {/* Rincian Transaksi jika Auto-Payment */}
                          {(detail.transactionId || detail.invoice || detail.nominal) && (
                            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5 text-[11px] text-purple-950 flex flex-wrap items-center justify-between gap-2 font-mono">
                              <div>
                                <span className="font-bold text-purple-900 font-sans">No. Invoice: </span>
                                <span>{detail.invoice || detail.transactionId}</span>
                              </div>
                              {detail.nominal && (
                                <div className="font-bold text-emerald-700 font-sans">
                                  Total: {formatRupiah(detail.nominal)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Footer & Detail Teknis Payload JSON */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                            <div>
                              {log.sender_name && (
                                <span>Pengirim/Kasir: <strong className="text-slate-600">{log.sender_name}</strong></span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 hover:underline"
                            >
                              <span>Detail Teknis Payload JSON</span>
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto max-h-48 border border-slate-800">
                              <pre>{JSON.stringify(detail, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-6 bg-gray-50 rounded-2xl text-center text-xs text-gray-400 italic space-y-1">
                  <p className="font-bold text-gray-600">Belum ada riwayat pesan WhatsApp.</p>
                  <p>Log akan otomatis tercatat saat webhook menerima foto bukti transfer atau pesan dari klien.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Modal Lightbox Foto Bukti Pembayaran */}
        {previewImageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setPreviewImageModal(null)}
          >
            <div
              className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Image size={18} className="text-emerald-600" />
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">{previewImageModal.title}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(previewImageModal.time).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="bg-slate-950 rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center p-2">
                <img
                  src={previewImageModal.url}
                  alt="Bukti Transfer Penuh"
                  className="max-h-[68vh] w-auto max-w-full object-contain rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-slate-500">Foto bukti tersimpan di database sistem kasir</span>
                <div className="flex gap-2">
                  <a
                    href={previewImageModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>Buka Tab Baru</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewImageModal(null)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Akun Admin (khusus superadmin) */}
        {isSuper && activeTab === 'admin' && <AdminAccountsPanel transactions={transactions} companyInfo={localCompany} session={session} />}

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
