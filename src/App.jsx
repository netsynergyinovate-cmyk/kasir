import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Building2, Search, LogOut, Lock } from 'lucide-react';
import { supabase, testConnection } from './lib/supabase';
import { formatRupiah } from './utils/format';
import { sendPaymentToBillingSystem, fetchCustomersFromEbilling } from './utils/billingApi';
import { isPathAllowedForRole, ADMIN_DEFAULT_PATH } from './utils/permissions';
import { saveLastPath, getLastPath } from './utils/lastPage';
import { loadVerifiedProfile, clearLoginRecorded, updateMyName } from './utils/authProfile';

import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Pelanggan from './pages/Pelanggan';
import Transaksi from './pages/Transaksi';
import Settings from './pages/Settings';
import Instansi from './pages/Instansi';
import History from './pages/History';
import Aktivitas from './pages/Aktivitas';
import AddCustomerModal from './components/AddCustomerModal';
import ReceiptThermal from './components/ReceiptThermal';
import ReceiptA4 from './components/ReceiptA4';
import GlobalSearch from './components/GlobalSearch';

import Login from './pages/Login';
import DashboardSuperadmin from './pages/DashboardSuperadmin';
import Rute from './pages/Rute';
import RunsnetSyncToast from './components/RunsnetSyncToast';
import UpdateBanner from './components/UpdateBanner';
import { customerVisitStatus } from './utils/visits';
import { describeRouteError } from './utils/dbErrors';
import { useShareLocation } from './hooks/useShareLocation';
import { useAdminLocations } from './hooks/useAdminLocations';
import PinPad from './components/PinPad';
import { useIdleLock } from './hooks/useIdleLock';
import { formatCountdown, countdownTone, markActivity } from './utils/idleLock';

const INIT_COMPANY = {
  name: 'PT Net Synergy Inovate',
  address: 'Loading...',
  phone: '',
  logo: null,
  adminName: 'Admin',
  adminFee: 10000,
  appPin: null,
  apiMonitoringUrl: '',
  apiMonitoringKey: localStorage.getItem('api_monitoring_key') || '',
  apiMonitoringEnabled: localStorage.getItem('api_monitoring_enabled') === 'true'
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [customers, setCustomers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);

  // Admin membagikan posisinya ke superadmin selama aplikasi terbuka; superadmin memantau posisi semua admin.
  const shareLocation = useShareLocation({ enabled: session?.profile?.role === 'admin', userId: session?.user?.id });
  const adminLocations = useAdminLocations({ enabled: session?.profile?.role === 'superadmin' });

  // Label kunjungan untuk daftar Pelanggan: hanya yang sudah didatangi dan masih menunggu / perlu didatangi lagi.
  const visitStatusById = useMemo(() => {
    const map = {};
    if (visits.length === 0) return map;
    const paidCheck = transactions.map(t => ({ ...t, customerName: t.customer_name }));
    customers.forEach(c => {
      const status = customerVisitStatus(c, visits, paidCheck);
      if (status.key === 'menunggu' || status.key === 'perlu_didatangi') map[c.id] = status;
    });
    return map;
  }, [customers, visits, transactions]);
  const [companyInfo, setCompanyInfo] = useState(INIT_COMPANY);
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [receiptToView, setReceiptToView] = useState(null);
  const [runsnetResult, setRunsnetResult] = useState(null);
  const [draftReceiptId, setDraftReceiptId] = useState(null);
  const [instansiReceiptToView, setInstansiReceiptToView] = useState(null);

  const [btDevice, setBtDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [, setBtTick] = useState(0);
  const [savedDeviceName, setSavedDeviceName] = useState(localStorage.getItem('last_printer_name') || '');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('PWA Install prompt tersedia.');
    });
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      console.log("Browser ini tidak mendukung notifikasi.");
      return;
    }
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      await Notification.requestPermission();
    }
  };

  const showNotification = async (title, body) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  const requestLocationPermission = async () => {
    // Pada Android Chrome, izin Lokasi wajib agar Bluetooth bisa memindai & menyimpan perangkat
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => console.log("Izin lokasi diberikan."),
        () => console.warn("Izin lokasi ditolak, fitur simpan printer mungkin terbatas."),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async (authSession) => {
      if (!authSession) {
        if (isMounted) setSession(null);
        return;
      }
      const result = await loadVerifiedProfile(supabase, authSession);
      if (!isMounted) return;

      if (result.error) {
        setAuthError(result.error);
        setSession(null);
        await supabase.auth.signOut();
        return;
      }

      setAuthError(null);
      setSession({ ...authSession, profile: result.profile });
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) {
        await loadProfile(data.session);
      } else if (isMounted) {
        setSession(null);
      }
      if (isMounted) setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_OUT') {
        clearLoginRecorded();
        if (isMounted) setSession(null);
        return;
      }
      loadProfile(authSession);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handlePinSetup = async (hashedPin) => {
    try {
      const { error } = await supabase.from('company_settings').upsert({
        id: 1,
        app_pin: hashedPin
      });
      if (error) throw error;
      setCompanyInfo({ ...companyInfo, appPin: hashedPin });
      localStorage.setItem('device_unlocked', 'true');
      markActivity();
      setIsLocked(false);
    } catch (e) {
      console.error('Error saving PIN to DB:', e);
      alert('Gagal menyimpan PIN.');
    }
  };

  const handleUnlock = () => {
    markActivity(); // hitungan 15 menit mulai dari nol setelah kode benar
    setIsLocked(false);
  };

  // Nama tampilan akun yang sedang login (dipakai di header, struk, dsb) — tiap admin/superadmin
  // mengubah namanya sendiri, bukan satu nama bersama untuk semua akun.
  const handleUpdateMyName = async (fullName) => {
    const { error } = await updateMyName(supabase, fullName);
    if (!error) {
      setSession((prev) => (prev ? { ...prev, profile: { ...prev.profile, full_name: fullName } } : prev));
    }
    return error;
  };

  // Kunci otomatis: setelah 15 menit tanpa disentuh (atau tombol Kunci), minta kode PIN lagi.
  const lockApp = () => {
    localStorage.removeItem('device_unlocked');
    setIsLocked(true);
  };
  const idleLockEnabled = Boolean(session) && !isLoading && Boolean(companyInfo.appPin) && !isLocked;
  const idleRemaining = useIdleLock({ enabled: idleLockEnabled, onLock: lockApp });

  // Determine lock state based on session, DB pin, and local unlock flag
  useEffect(() => {
    if (session && !isLoading) {
      const isDeviceUnlocked = localStorage.getItem('device_unlocked') === 'true';
      if (!isDeviceUnlocked && companyInfo.appPin) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    }
  }, [session, companyInfo.appPin, isLoading]);

  useEffect(() => {
    if (session?.profile?.role === 'admin' && !isPathAllowedForRole('admin', location.pathname, session.profile?.allowed_paths)) {
      navigate(ADMIN_DEFAULT_PATH, { replace: true });
    }
  }, [session, location.pathname, navigate]);

  // Ingat halaman yang sedang dibuka, supaya membuka ulang aplikasi (ikon PWA selalu mulai dari '/', bukan
  // halaman terakhir) bisa kembali ke sana, bukan selalu ke Beranda.
  useEffect(() => {
    saveLastPath(location.pathname);
  }, [location.pathname]);

  // Dipulihkan HANYA saat aplikasi baru saja "mendarat" di '/' setelah login/buka-kunci — itu tandanya
  // start_url PWA yang membuka, bukan pilihan sadar membuka Beranda dari menu.
  useEffect(() => {
    if (!session || !authChecked || isLoading || isLocked || location.pathname !== '/') return;
    const last = getLastPath();
    if (last && last !== '/' && isPathAllowedForRole(session.profile?.role, last, session.profile?.allowed_paths)) {
      navigate(last, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authChecked, isLoading, isLocked]);

  useEffect(() => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      console.log('Mulai mengambil data dari Supabase...');
      try {
        const [
          { data: custData, error: custErr }, 
          { data: transData, error: transErr }, 
          { data: pkgData, error: pkgErr },
          { data: settingsData, error: setErr },
          { data: visitData, error: visitErr }
        ] = await Promise.all([
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('packages').select('*').order('name'),
          supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('customer_visits').select('*')
            .gte('visited_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
            .order('visited_at', { ascending: false })
        ]);

        if (custErr) console.error('Error Customers:', custErr.message);
        if (transErr) console.error('Error Transactions:', transErr.message);
        if (pkgErr) console.error('Error Packages:', pkgErr.message);
        if (setErr) console.error('Error Settings:', setErr.message);
        if (visitErr) console.warn('Catatan kunjungan belum tersedia:', visitErr.message);
        if (visitData) setVisits(visitData);

        if (custData) setCustomers(custData);
        if (transData) {
          const localTrx = JSON.parse(localStorage.getItem('kasir_local_transactions') || '[]');
          const trxMap = new Map();
          transData.forEach(t => trxMap.set(t.id, t));
          localTrx.forEach(t => {
            if (!trxMap.has(t.id)) trxMap.set(t.id, t);
          });
          setTransactions(Array.from(trxMap.values()));
        } else {
          const localTrx = JSON.parse(localStorage.getItem('kasir_local_transactions') || '[]');
          if (localTrx.length > 0) setTransactions(localTrx);
        }
        if (pkgData) setPackages(pkgData);
        if (settingsData) {
          const storedKey = localStorage.getItem('api_monitoring_key') || '';
          const storedEnabled = localStorage.getItem('api_monitoring_enabled') === 'true';

          const finalKey = (settingsData.api_monitoring_key && settingsData.api_monitoring_key.trim()) ? settingsData.api_monitoring_key : storedKey;
          const finalEnabled = settingsData.api_monitoring_enabled ?? storedEnabled;

          if (finalKey) {
            localStorage.setItem('api_monitoring_key', finalKey);
          }

          setCompanyInfo({
            name: settingsData.name,
            address: settingsData.address,
            phone: settingsData.phone,
            logo: settingsData.logo_url,
            adminName: settingsData.admin_name || 'Admin',
            adminFee: settingsData.admin_fee || 10000,
            appPin: settingsData.app_pin || null,
            apiMonitoringUrl: settingsData.api_monitoring_url || '',
            apiMonitoringKey: finalKey,
            apiMonitoringEnabled: finalEnabled
          });
        }
        console.log('Data berhasil dimuat.');
      } catch (error) {
        console.error('Koneksi Gagal:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    testConnection();
    requestNotificationPermission();
    requestLocationPermission();
  }, [session]);

  const PRINTER_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '00001101-0000-1000-8000-00805f9b34fb',
  ];

  // Printer thermal sering memutus GATT sendiri saat menganggur. Yang diingat adalah PERANGKAT-nya (sudah
  // dipasangkan), bukan status sambungannya: kalau terputus, printer tetap dianggap siap dan disambung
  // ulang otomatis saat mencetak (lihat ReceiptThermal.printViaBluetooth).
  const attachPrinter = (device) => {
    setBtDevice(device);
    const name = device.name || 'Printer Terhubung';
    setSavedDeviceName(name);
    localStorage.setItem('last_printer_name', name);
    if (!device.__kasirBound) {
      device.__kasirBound = true;
      device.addEventListener('gattserverdisconnected', () => {
        setBtTick((t) => t + 1); // segarkan status di Pengaturan; perangkat tetap diingat
        console.log('Printer terputus (akan disambung ulang saat mencetak).');
      });
    }
  };

  // Muat ulang printer yang pernah dipasangkan begitu aplikasi dibuka (tanpa menyambung dulu; sambungan
  // baru dibuat saat mencetak). Diam-diam gagal kalau browser tidak mendukung getDevices.
  useEffect(() => {
    if (!session || btDevice) return;
    const remembered = localStorage.getItem('last_printer_name');
    if (!remembered || !navigator.bluetooth?.getDevices) return;
    navigator.bluetooth.getDevices()
      .then((devices) => {
        const device = devices.find((d) => d.name === remembered);
        if (device) attachPrinter(device);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const connectBluetooth = async () => {
    setIsConnecting(true);
    try {
      if (!navigator.bluetooth) throw new Error('Browser tidak mendukung Bluetooth. Pastikan menggunakan Chrome/Edge di Android atau HTTPS.');

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });
      attachPrinter(device);
      try {
        await device.gatt.connect();
      } catch (connectError) {
        console.warn('Printer dipasangkan, tapi belum tersambung:', connectError);
      }
      setBtTick((t) => t + 1);
    } catch (e) {
      console.error(e);
      if (e.name !== 'NotFoundError') {
        alert(e.message || 'Gagal menghubungkan printer.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectBluetooth = () => {
    if (btDevice && btDevice.gatt.connected) {
      btDevice.gatt.disconnect();
    }
    setBtDevice(null);
    setSavedDeviceName('');
    localStorage.removeItem('last_printer_name');
  };

  // Mencari printer yang pernah dipasangkan dari daftar izin browser (butuh dukungan getDevices).
  const findRememberedPrinter = async () => {
    const remembered = localStorage.getItem('last_printer_name');
    if (!remembered || !navigator.bluetooth?.getDevices) return null;
    const devices = await navigator.bluetooth.getDevices();
    return devices.find((d) => d.name === remembered) || null;
  };

  const reconnectBluetooth = async () => {
    setIsConnecting(true);
    try {
      if (!navigator.bluetooth) throw new Error('Browser tidak mendukung Bluetooth.');
      const device = btDevice || await findRememberedPrinter();
      if (!device) throw new Error('Printer tidak ditemukan dalam daftar sistem browser. Silakan hubungkan ulang secara manual.');
      attachPrinter(device);
      await device.gatt.connect();
      setBtTick((t) => t + 1);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Gagal menyambung ulang otomatis.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Dipanggil dari struk saat kasir menekan tombol simpan/cetak dan printer sudah pernah dipasangkan tapi
  // belum dimuat di sesi ini (mis. setelah aplikasi dibuka ulang). Mengembalikan perangkat atau null.
  // Harus dipanggil langsung dari sentuhan pengguna karena bisa memunculkan dialog pilih perangkat.
  const ensurePrinter = async () => {
    if (btDevice) return btDevice;
    try {
      const remembered = await findRememberedPrinter();
      if (remembered) {
        attachPrinter(remembered);
        return remembered;
      }
      const name = localStorage.getItem('last_printer_name');
      if (!name || !navigator.bluetooth) return null;
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name }],
        optionalServices: PRINTER_SERVICES,
      });
      attachPrinter(device);
      return device;
    } catch (e) {
      console.warn('Printer tidak dipilih/ditemukan:', e);
      return null;
    }
  };

  // Form Transaksi hanya menyiapkan struk (draf) — belum ada yang tersimpan. Baru saat kasir menekan
  // Simpan/Cetak di struk, commitTransaction dijalankan.
  const handleTransactionComplete = (newTrx) => {
    setReceiptToView(newTrx);
    setDraftReceiptId(newTrx.id);
  };

  // Meminta server mengirim pembayaran transaksi ini ke Runsnet dan membuktikan statusnya PAID. Berjalan di latar
  // belakang (hasilnya muncul di notifikasi kecil dan di log Runsnet); kegagalan jaringan tidak mengganggu kasir.
  const triggerRunsnetSync = (transactionId) => {
    if (!session?.access_token) return;
    fetch('/api/runsnet/sync-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ transactionId }),
    })
      .then((response) => response.json().then((result) => ({ ok: response.ok, result })))
      .then(({ ok, result }) => {
        // Hasil ditampilkan langsung dari jawaban server (sama untuk admin dan superadmin).
        if (!ok) setRunsnetResult({ status: 'failed', message: result.error || 'Server menolak permintaan sinkron.' });
        else if (result.status) setRunsnetResult({ status: result.status, message: result.message });
      })
      .catch((e) => {
        console.warn('Sinkron Runsnet tidak terkirim:', e.message);
        setRunsnetResult({ status: 'failed', message: 'Tidak bisa menghubungi server sinkron Runsnet: ' + e.message });
      });
  };

  const commitTransaction = async (newTrx) => {
    try {
      console.log('Menyimpan Transaksi Retail...');
      
      // 1. Simpan ke database Supabase dengan kolom yang valid sesuai skema
      const payload = {
        id: newTrx.id,
        date: newTrx.date,
        customer_name: newTrx.customerName || newTrx.customer_name,
        package_name: newTrx.packageName || newTrx.package_name,
        price: Number(newTrx.price) || 0,
        status: newTrx.status || 'LUNAS',
        payment_method: newTrx.paymentMethod || newTrx.payment_method || 'Cash',
        amount_paid: Number(newTrx.amountPaid) || Number(newTrx.price) || 0,
        cashier_name: newTrx.cashierName || newTrx.cashier_name || 'Admin',
        cashier_id: newTrx.cashierId || newTrx.cashier_id || null,
        invoice_number: newTrx.invoiceNumber || newTrx.invoice_number || null,
        type: 'retail'
      };

      const { error } = await supabase.from('transactions').insert([payload]);

      if (error) {
        console.warn('DB Insert Note:', error.message);
      } else {
        console.log('✅ Transaksi berhasil tersimpan permanen ke Supabase.');
      }

      // 2. Simpan backup lokal agar transaksi dijamin tidak pernah hilang
      const existingLocal = JSON.parse(localStorage.getItem('kasir_local_transactions') || '[]');
      const filteredExisting = existingLocal.filter(t => t.id !== newTrx.id);
      localStorage.setItem('kasir_local_transactions', JSON.stringify([newTrx, ...filteredExisting]));

      // 3. Perbarui status pembayaran pelanggan di database & state lokal
      const custId = newTrx.customerId || newTrx.custid;
      if (custId) {
        try {
          await supabase.from('customers').update({
            status: 'aktif',
            last_payment_date: newTrx.date
          }).eq('id', custId);
        } catch (custErr) {
          console.warn('Customer status update note:', custErr);
        }

        setCustomers(prev => prev.map(c => (c.id === custId || c.custid === custId) ? { ...c, status: 'aktif', last_payment_date: newTrx.date } : c));
      }

      setTransactions(prev => [newTrx, ...prev.filter(t => t.id !== newTrx.id)]);
      if (!error) triggerRunsnetSync(newTrx.id);
      showNotification('Transaksi Berhasil', `${newTrx.customerName} - ${formatRupiah(newTrx.price)}`);

      // Automasi pengiriman data ke Billing Monitoring System
      sendPaymentToBillingSystem(newTrx, companyInfo);
    } catch (e) {
      console.error('DB Insert Error:', e.message);
      const existingLocal = JSON.parse(localStorage.getItem('kasir_local_transactions') || '[]');
      const filteredExisting = existingLocal.filter(t => t.id !== newTrx.id);
      localStorage.setItem('kasir_local_transactions', JSON.stringify([newTrx, ...filteredExisting]));
      setTransactions(prev => [newTrx, ...prev.filter(t => t.id !== newTrx.id)]);
      showNotification('Transaksi Berhasil', `${newTrx.customerName} - ${formatRupiah(newTrx.price)}`);
    }
    return true;
  };

  const handleInstansiComplete = async (newTrx) => {
    try {
      const payload = {
        id: newTrx.id,
        date: newTrx.date,
        instansi_name: newTrx.instansiName || newTrx.instansi_name,
        address: newTrx.address,
        service_name: newTrx.serviceName || newTrx.service_name,
        price: Number(newTrx.price) || 0,
        cashier_name: newTrx.cashierName || newTrx.cashier_name || 'Admin',
        type: 'instansi'
      };

      const { error } = await supabase.from('transactions').insert([payload]);

      if (error) console.warn('Instansi DB insert note:', error.message);

      const existingLocal = JSON.parse(localStorage.getItem('kasir_local_transactions') || '[]');
      const filteredExisting = existingLocal.filter(t => t.id !== newTrx.id);
      localStorage.setItem('kasir_local_transactions', JSON.stringify([newTrx, ...filteredExisting]));

      setTransactions(prev => [newTrx, ...prev.filter(t => t.id !== newTrx.id)]);
      setInstansiReceiptToView(newTrx);
      if (!error) triggerRunsnetSync(newTrx.id);
      showNotification('Invoice Instansi Berhasil', `${newTrx.instansiName} - ${formatRupiah(newTrx.price)}`);

      // Automasi pengiriman data ke Billing Monitoring System
      sendPaymentToBillingSystem(newTrx, companyInfo);
    } catch (e) {
      alert('Gagal menyimpan invoice: ' + e.message);
    }
  };

  const handleAddCustomer = async (newCust) => {
    try {
      const { error } = await supabase.from('customers').insert([{
        id: newCust.id,
        custid: newCust.custid || newCust.customer_id || null,
        customer_id: newCust.customer_id || newCust.custid || null,
        pppoe_id: newCust.pppoe_id || newCust.pppoeId || null,
        name: newCust.name,
        nickname: newCust.nickname,
        address: newCust.address,
        package: newCust.package,
        phone: newCust.phone || null,
        ip_address: newCust.ip_address || newCust.ipAddress || null,
        mac_address: newCust.mac_address || newCust.macAddress || null,
        serial_number: newCust.serial_number || newCust.serialNumber || null,
        router_name: newCust.router_name || newCust.routerName || null,
        price: newCust.price ? Number(newCust.price) : null,
        source: newCust.source || 'kasir',
        last_synced: newCust.last_synced || null,
        last_payment_date: newCust.last_payment_date || null,
        due_date: newCust.dueDate || newCust.due_date,
        status: newCust.status || 'aktif'
      }]);

      if (error) console.warn('Insert customer note:', error.message);
      setCustomers([newCust, ...customers]);
      setShowAddCustomer(false);
    } catch (e) {
      alert('Gagal menambah pelanggan: ' + e.message);
    }
  };

  const handleAddVisit = async ({ customer_id, outcome, available_on }) => {
    const { data, error } = await supabase
      .from('customer_visits')
      .insert({ customer_id, outcome, available_on, visited_by_name: session?.profile?.full_name || null })
      .select()
      .single();

    if (error) {
      alert('Gagal menyimpan kunjungan: ' + describeRouteError(error));
      return false;
    }
    setVisits(prev => [data, ...prev]);
    return true;
  };

  // Koordinat dan urutan rute hanya boleh diubah superadmin (dijaga RLS di database).
  const handleUpdateCustomerRoute = async (id, patch) => {
    const { error } = await supabase.from('customers').update(patch).eq('id', id);
    if (error) {
      alert('Gagal menyimpan rute: ' + describeRouteError(error));
      return false;
    }
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
    return true;
  };

  // Memuat ulang daftar pelanggan dari Supabase — dipanggil setelah impor pelanggan terpilih dari
  // Runsnet, supaya yang baru masuk langsung terlihat tanpa perlu refresh halaman.
  const refetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!error && data) setCustomers(data);
  };

  const handleUpdateCustomerDB = async (updatedCustomer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          custid: updatedCustomer.custid || updatedCustomer.customer_id || null,
          customer_id: updatedCustomer.customer_id || updatedCustomer.custid || null,
          pppoe_id: updatedCustomer.pppoe_id || updatedCustomer.pppoeId || null,
          name: updatedCustomer.name,
          nickname: updatedCustomer.nickname,
          address: updatedCustomer.address,
          package: updatedCustomer.package,
          phone: updatedCustomer.phone || null,
          ip_address: updatedCustomer.ip_address || updatedCustomer.ipAddress || null,
          mac_address: updatedCustomer.mac_address || updatedCustomer.macAddress || null,
          serial_number: updatedCustomer.serial_number || updatedCustomer.serialNumber || null,
          router_name: updatedCustomer.router_name || updatedCustomer.routerName || null,
          price: updatedCustomer.price ? Number(updatedCustomer.price) : null,
          due_date: updatedCustomer.dueDate || updatedCustomer.due_date
        })
        .eq('id', updatedCustomer.id);

      if (error) console.warn('Update customer note:', error.message);
      
      // Update local state
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c));
    } catch (e) {
      console.error('Error updating customer:', e);
      alert('Gagal memperbarui data pelanggan!');
    }
  };

  const handleSyncCustomersFromEbilling = async () => {
    try {
      const result = await fetchCustomersFromEbilling(companyInfo.apiMonitoringUrl, companyInfo.apiMonitoringKey);
      if (!result.success || !result.customers || result.customers.length === 0) {
        alert(result.message || 'Gagal menyinkronkan data dari E-Billing.');
        return result;
      }

      // Upsert ke Supabase & update local state
      const newOrUpdated = [...result.customers];
      
      try {
        const payloadSupabase = newOrUpdated.map(c => ({
          id: c.id,
          custid: c.custid || c.customer_id || null,
          customer_id: c.customer_id || c.custid || null,
          pppoe_id: c.pppoe_id,
          name: c.name,
          nickname: c.nickname,
          address: c.address,
          package: c.package,
          phone: c.phone || null,
          ip_address: c.ip_address || null,
          mac_address: c.mac_address || null,
          serial_number: c.serial_number || null,
          router_name: c.router_name || null,
          price: c.price || null,
          source: c.source || 'E-Billing',
          last_synced: c.last_synced || new Date().toISOString(),
          last_payment_date: c.last_payment_date || null,
          status: c.status,
          due_date: c.due_date
        }));
        await supabase.from('customers').upsert(payloadSupabase, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('Upsert customer Supabase note:', dbErr);
      }

      // Merge local customers state with synced data
      setCustomers(prev => {
        const map = new Map();
        prev.forEach(item => map.set(item.id, item));
        newOrUpdated.forEach(item => map.set(item.id, { ...map.get(item.id), ...item }));
        return Array.from(map.values());
      });

      showNotification('Sinkronisasi E-Billing', result.message);
      return result;
    } catch (err) {
      console.error('Error syncing customers from E-Billing:', err);
      alert('Terjadi kesalahan saat menarik data dari E-Billing.');
      return { success: false, message: err.message };
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    const keyToSave = newSettings.apiMonitoringKey || localStorage.getItem('api_monitoring_key') || '';
    if (keyToSave) {
      localStorage.setItem('api_monitoring_key', keyToSave);
    }
    if (newSettings.apiMonitoringEnabled !== undefined) {
      localStorage.setItem('api_monitoring_enabled', newSettings.apiMonitoringEnabled ? 'true' : 'false');
    }

    const mergedSettings = {
      ...newSettings,
      apiMonitoringKey: keyToSave
    };

    setCompanyInfo(mergedSettings);

    try {
      const payload = {
        id: 1,
        name: mergedSettings.name,
        address: mergedSettings.address,
        phone: mergedSettings.phone,
        logo_url: mergedSettings.logo,
        admin_name: mergedSettings.adminName,
        admin_fee: mergedSettings.adminFee,
        api_monitoring_url: mergedSettings.apiMonitoringUrl || '',
        api_monitoring_key: keyToSave,
        api_monitoring_enabled: mergedSettings.apiMonitoringEnabled ?? false
      };
      const { error } = await supabase.from('company_settings').upsert(payload);
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase settings upsert note:', e);
      alert('Pengaturan (termasuk logo) belum tersimpan ke database: ' + (e.message || e));
    }
  };

  const handleAddPackageDB = async (pkgName, pkgPrice) => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .insert([{ name: pkgName, price: Number(pkgPrice) }])
        .select();

      if (error) throw error;
      if (data) setPackages([...packages, ...data]);
    } catch (e) {
      alert('Gagal menambah paket: ' + e.message);
    }
  };

  const handleDeletePackageDB = async (id) => {
    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPackages(packages.filter(p => p.id !== id));
    } catch (e) {
      alert('Gagal menghapus paket: ' + e.message);
    }
  };

  const handleDeleteTransactionDB = async (id) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) console.warn('Delete DB note:', error.message);
      
      const localTrx = JSON.parse(localStorage.getItem('kasir_local_transactions') || '[]');
      localStorage.setItem('kasir_local_transactions', JSON.stringify(localTrx.filter(t => t.id !== id)));
      
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (e) {
      alert('Gagal menghapus transaksi: ' + e.message);
    }
  };

  const handleDeleteCustomerDB = async (id) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCustomers(customers.filter(c => c.id !== id));
    } catch (e) {
      alert('Gagal menghapus pelanggan: ' + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!authChecked || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-blue-600">
        <div className="flex space-x-2 mb-4">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce animation-delay-100"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce animation-delay-200"></div>
        </div>
        <p className="font-bold animate-pulse">Memuat...</p>
      </div>
    );
  }

  if (!session) {
    return <Login externalError={authError} />;
  }

  // If session exists, data is loaded, but no DB Pin exists and not bypassed -> Setup mode
  if (session && !isLoading && session.profile?.role !== 'admin' && !companyInfo.appPin && localStorage.getItem('bypass_pin') !== 'true') {
    return (
      <PinPad 
        mode="setup" 
        onSetup={handlePinSetup} 
        onSkip={() => {
          localStorage.setItem('bypass_pin', 'true');
          setIsLocked(false);
          setCompanyInfo(prev => ({ ...prev }));
        }} 
      />
    );
  }

  // If session exists, DB Pin exists, but device is locked -> Unlock mode
  if (session && !isLoading && companyInfo.appPin && isLocked) {
    return <PinPad mode="unlock" dbPin={companyInfo.appPin} onUnlock={handleUnlock} />;
  }

  return (
    <div className={`min-h-screen font-sans ${receiptToView || instansiReceiptToView ? 'print-container' : ''}`}>
      
      <div className="flex-1 relative flex flex-col print:hidden">
        
        <div className="sticky top-0 z-10 shrink-0">
        {idleLockEnabled && (
          <div className={`flex items-center justify-center gap-2 px-3 py-1 text-[11px] font-bold text-white transition-colors ${countdownTone(idleRemaining) === 'critical' ? 'bg-red-600 animate-pulse' : countdownTone(idleRemaining) === 'warning' ? 'bg-amber-500' : 'bg-slate-800'}`}>
            <Lock size={12} className="shrink-0" />
            <span>Terkunci otomatis dalam <span className="font-mono tabular-nums">{formatCountdown(idleRemaining)}</span></span>
            <button type="button" onClick={lockApp} className="ml-1 px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25 active:scale-95 transition-all">Kunci sekarang</button>
          </div>
        )}
        <header className="bg-white px-4 py-3.5 border-b border-gray-100 flex items-center gap-3 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-1 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
            <Menu size={22} />
          </button>

          {companyInfo.logo ? (
            <img src={companyInfo.logo} alt="Logo" className="w-9 h-9 rounded-xl object-contain shadow-sm border border-gray-100 shrink-0 bg-white p-0.5" />
          ) : (
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-200 shrink-0">
              <Building2 size={18} />
            </div>
          )}
          <div className="overflow-hidden">
            <h1 className="font-bold text-gray-900 text-[15px] leading-tight truncate">{companyInfo.name}</h1>
            <p className="text-[11px] text-gray-500 font-medium">ISP Billing POS</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button onClick={() => setIsSearchOpen(true)} className="p-2 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
              <Search size={18} />
            </button>
            <button 
              onClick={async () => {
                if (window.confirm('Keluar dari akun dan kembali ke halaman login?')) {
                  localStorage.removeItem('device_unlocked');
                  localStorage.removeItem('kasir_user');
                  try {
                    await supabase.auth.signOut();
                  } catch (e) {}
                  setSession(null);
                }
              }} 
              title="Keluar / Ganti Akun"
              className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl active:scale-95 transition-all"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        </div>

        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          companyInfo={companyInfo} 
          session={session}
        />

        <main className="flex-1 overflow-y-auto relative">
          <Routes>
            <Route path="/" element={
              session?.profile?.role === 'superadmin' ? (
                <DashboardSuperadmin
                  session={session}
                  visits={visits}
                  onAddVisit={handleAddVisit}
                  adminLocations={adminLocations}
                  transactions={transactions.map(t => ({...t, customerName: t.customer_name, instansiName: t.instansi_name}))} 
                  customers={customers} 
                  packages={packages}
                  companyInfo={companyInfo}
                  setReceiptToView={setReceiptToView} 
                  setInstansiReceiptToView={setInstansiReceiptToView} 
                />
              ) : (
                <Dashboard
                  session={session}
                  visits={visits}
                  onAddVisit={handleAddVisit}
                  origin={shareLocation.routeOrigin}
                  myPosition={shareLocation.position}
                  locationStatus={shareLocation.status}
                  onRetryLocation={shareLocation.retry}
                  transactions={transactions.map(t => ({...t, customerName: t.customer_name, instansiName: t.instansi_name, cashierId: t.cashier_id}))}
                  customers={customers}
                  packages={packages}
                  companyInfo={companyInfo}
                  setReceiptToView={setReceiptToView}
                  setInstansiReceiptToView={setInstansiReceiptToView}
                />
              )
            } />
            <Route path="/history" element={
              <History 
                role={session?.profile?.role}
                session={session}
                transactions={transactions.map(t => ({...t, customerName: t.customer_name, instansiName: t.instansi_name, packageName: t.package_name, serviceName: t.service_name, amountPaid: t.amount_paid, cashierName: t.cashier_name}))} 
                setReceiptToView={setReceiptToView} 
                setInstansiReceiptToView={setInstansiReceiptToView} 
                onDeleteTransaction={handleDeleteTransactionDB}
              />
            } />
            <Route path="/customers" element={
              <Pelanggan
                customers={customers}
                packages={packages}
                role={session?.profile?.role}
                session={session}
                onRunsnetImported={refetchCustomers}
                visitStatusById={visitStatusById}
                setShowAddCustomer={setShowAddCustomer} 
                onDeleteCustomer={handleDeleteCustomerDB}
                onUpdateCustomer={handleUpdateCustomerDB}
                onSyncEbilling={handleSyncCustomersFromEbilling}
              />
            } />
            <Route path="/rute" element={
              <Rute
                customers={customers}
                transactions={transactions.map(t => ({...t, customerName: t.customer_name}))}
                visits={visits}
                role={session?.profile?.role}
                onAddVisit={handleAddVisit}
                adminLocations={adminLocations}
                onUpdateCustomerRoute={handleUpdateCustomerRoute}
              />
            } />
            <Route path="/settings" element={
              <Settings 
                session={session}
                packages={packages} 
                onAddPackage={handleAddPackageDB}
                onDeletePackage={handleDeletePackageDB}
                companyInfo={companyInfo}
                setCompanyInfo={handleUpdateSettings}
                btDevice={btDevice}
                isConnecting={isConnecting}
                connectBluetooth={connectBluetooth}
                disconnectBluetooth={disconnectBluetooth}
                reconnectBluetooth={reconnectBluetooth}
                savedDeviceName={savedDeviceName}
                deferredPrompt={deferredPrompt}
                onInstall={installApp}
                onSyncEbilling={handleSyncCustomersFromEbilling}
                onUpdateMyName={handleUpdateMyName}
                />
            } />
            <Route path="/pos" element={
              <Transaksi 
                customers={customers} 
                packages={packages} 
                companyInfo={companyInfo}
                session={session}
                transactions={transactions}
                onComplete={handleTransactionComplete} 
              />
            } />
            <Route path="/instansi" element={
               <Instansi onComplete={handleInstansiComplete} />
            } />
            <Route path="/aktivitas" element={
              <Aktivitas
                transactions={transactions.map(t => ({ ...t, customerName: t.customer_name, instansiName: t.instansi_name, cashierName: t.cashier_name }))}
              />
            } />
          </Routes>
        </main>

        <Navigation role={session?.profile?.role} allowedPaths={session?.profile?.allowed_paths} />
      </div>

      <RunsnetSyncToast result={runsnetResult} onDone={() => setRunsnetResult(null)} />
      <UpdateBanner />

      <AddCustomerModal
        show={showAddCustomer}
        packages={packages}
        companyInfo={companyInfo}
        onClose={() => setShowAddCustomer(false)}
        onAdd={handleAddCustomer}
      />

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        customers={customers}
        transactions={transactions.map(t => ({ ...t, customerName: t.customer_name, instansiName: t.instansi_name }))}
        setReceiptToView={setReceiptToView}
        setInstansiReceiptToView={setInstansiReceiptToView}
      />
      
      <ReceiptThermal 
        key={receiptToView?.id}
        transaction={receiptToView} 
        isDraft={Boolean(receiptToView) && receiptToView.id === draftReceiptId}
        onCommit={async () => { const ok = await commitTransaction(receiptToView); setDraftReceiptId(null); return ok; }}
        companyInfo={companyInfo}
        onClose={() => { setReceiptToView(null); setDraftReceiptId(null); }} 
        onPrint={handlePrint} 
        btDevice={btDevice}
        savedDeviceName={savedDeviceName}
        ensurePrinter={ensurePrinter}
      />

      <ReceiptA4
        transaction={instansiReceiptToView}
        companyInfo={companyInfo}
        onClose={() => setInstansiReceiptToView(null)}
        onPrint={handlePrint}
      />
    </div>
  );
}
