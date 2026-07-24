import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Menu, Building2, Search } from 'lucide-react';
import { supabase, testConnection } from './lib/supabase';
import { formatRupiah } from './utils/format';
import { sendPaymentToBillingSystem, fetchCustomersFromEbilling } from './utils/billingApi';

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
import PinPad from './components/PinPad';

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
  const [session, setSession] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(INIT_COMPANY);
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [receiptToView, setReceiptToView] = useState(null);
  const [instansiReceiptToView, setInstansiReceiptToView] = useState(null);

  const [btDevice, setBtDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
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
      setIsLocked(false);
    } catch (e) {
      console.error('Error saving PIN to DB:', e);
      alert('Gagal menyimpan PIN.');
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

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
          { data: settingsData, error: setErr }
        ] = await Promise.all([
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('packages').select('*').order('name'),
          supabase.from('company_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        if (custErr) console.error('Error Customers:', custErr.message);
        if (transErr) console.error('Error Transactions:', transErr.message);
        if (pkgErr) console.error('Error Packages:', pkgErr.message);
        if (setErr) console.error('Error Settings:', setErr.message);

        if (custData) setCustomers(custData);
        if (transData) setTransactions(transData);
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

  const connectBluetooth = async () => {
    setIsConnecting(true);
    try {
      if (!navigator.bluetooth) throw new Error('Browser tidak mendukung Bluetooth. Pastikan menggunakan Chrome/Edge di Android atau HTTPS.');
      
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', 
          '0000ff00-0000-1000-8000-00805f9b34fb', 
          '00001101-0000-1000-8000-00805f9b34fb'
        ]
      });

      setBtDevice(device);
      setSavedDeviceName(device.name || 'Printer Terhubung');
      localStorage.setItem('last_printer_name', device.name || 'Printer Terhubung');

      device.addEventListener('gattserverdisconnected', () => {
        setBtDevice(null);
        console.log('Printer terputus secara otomatis.');
      });

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

  const reconnectBluetooth = async () => {
    setIsConnecting(true);
    try {
      if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
        throw new Error('Browser tidak mendukung fitur simpan perangkat.');
      }
      
      const devices = await navigator.bluetooth.getDevices();
      const lastDeviceName = localStorage.getItem('last_printer_name');
      
      if (!lastDeviceName) throw new Error('Tidak ada riwayat printer.');
      
      const device = devices.find(d => d.name === lastDeviceName);
      if (!device) throw new Error('Printer tidak ditemukan dalam daftar sistem browser. Silakan hubungkan ulang secara manual.');

      console.log('Mencoba menyambungkan kembali ke:', device.name);
      await device.gatt.connect();
      setBtDevice(device);
      setSavedDeviceName(device.name);
      
      device.addEventListener('gattserverdisconnected', () => {
        setBtDevice(null);
        console.log('Printer terputus.');
      });

    } catch (e) {
      console.error(e);
      alert(e.message || 'Gagal menyambung ulang otomatis.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTransactionComplete = async (newTrx) => {
    try {
      console.log('Menyimpan Transaksi Retail...');
      const { error } = await supabase.from('transactions').insert([{
        id: newTrx.id,
        date: newTrx.date,
        custid: newTrx.custid || newTrx.customerId || newTrx.pppoeId || null,
        customer_id: newTrx.customerId || newTrx.custid || newTrx.pppoeId || null,
        customer_name: newTrx.customerName,
        pppoe_id: newTrx.pppoeId || newTrx.pppoe_id || null,
        package_name: newTrx.packageName,
        price: newTrx.price,
        status: newTrx.status,
        payment_method: newTrx.paymentMethod,
        amount_paid: newTrx.amountPaid,
        cashier_name: newTrx.cashierName,
        type: 'retail'
      }]);

      if (error) console.warn('DB Insert Note:', error.message);
      setTransactions([newTrx, ...transactions]);
      setReceiptToView(newTrx);
      showNotification('Transaksi Berhasil', `${newTrx.customerName} - ${formatRupiah(newTrx.price)}`);
      console.log('Transaksi berhasil disimpan ke database.');

      // Automasi pengiriman data ke Billing Monitoring System
      sendPaymentToBillingSystem(newTrx, companyInfo);
    } catch (e) {
      console.error('DB Insert Error:', e.message);
      alert('Gagal simpan ke DB: ' + e.message);
    }
  };

  const handleInstansiComplete = async (newTrx) => {
    try {
      const { error } = await supabase.from('transactions').insert([{
        id: newTrx.id,
        date: newTrx.date,
        instansi_name: newTrx.instansiName,
        address: newTrx.address,
        service_name: newTrx.serviceName,
        price: newTrx.price,
        cashier_name: newTrx.cashierName,
        type: 'instansi'
      }]);

      if (error) throw error;
      setTransactions([newTrx, ...transactions]);
      setInstansiReceiptToView(newTrx);
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
        pppoe_id: newCust.pppoe_id || newCust.pppoeId || null,
        name: newCust.name,
        nickname: newCust.nickname,
        address: newCust.address,
        package: newCust.package,
        phone: newCust.phone || null,
        ip_address: newCust.ip_address || newCust.ipAddress || null,
        price: newCust.price ? Number(newCust.price) : null,
        source: newCust.source || 'kasir',
        last_synced: newCust.last_synced || null,
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

  const handleUpdateCustomerDB = async (updatedCustomer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          pppoe_id: updatedCustomer.pppoe_id || updatedCustomer.pppoeId || null,
          name: updatedCustomer.name,
          nickname: updatedCustomer.nickname,
          address: updatedCustomer.address,
          package: updatedCustomer.package,
          phone: updatedCustomer.phone || null,
          ip_address: updatedCustomer.ip_address || updatedCustomer.ipAddress || null,
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
          pppoe_id: c.pppoe_id,
          name: c.name,
          nickname: c.nickname,
          address: c.address,
          package: c.package,
          phone: c.phone || null,
          ip_address: c.ip_address || null,
          price: c.price || null,
          source: c.source || 'E-Billing',
          last_synced: c.last_synced || new Date().toISOString(),
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
      await supabase.from('company_settings').upsert(payload);
    } catch (e) {
      console.warn('Supabase settings upsert note:', e);
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

      if (error) throw error;
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

  if (isLoading) {
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
    return <Login />;
  }

  // If session exists, data is loaded, but no DB Pin exists and not bypassed -> Setup mode
  if (session && !isLoading && !companyInfo.appPin && localStorage.getItem('bypass_pin') !== 'true') {
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
        
        <header className="bg-white px-4 py-3.5 border-b border-gray-100 sticky top-0 z-10 flex items-center gap-3 shrink-0 shadow-sm">
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

          <button onClick={() => setIsSearchOpen(true)} className="ml-auto p-2 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shrink-0">
            <Search size={20} />
          </button>
        </header>

        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          companyInfo={companyInfo} 
        />

        <main className="flex-1 overflow-y-auto relative">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                transactions={transactions.map(t => ({...t, customerName: t.customer_name, instansiName: t.instansi_name}))} 
                customers={customers} 
                packages={packages}
                companyInfo={companyInfo}
                setReceiptToView={setReceiptToView} 
                setInstansiReceiptToView={setInstansiReceiptToView} 
              />
            } />
            <Route path="/history" element={
              <History 
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
                setShowAddCustomer={setShowAddCustomer} 
                onDeleteCustomer={handleDeleteCustomerDB}
                onUpdateCustomer={handleUpdateCustomerDB}
                onSyncEbilling={handleSyncCustomersFromEbilling}
              />
            } />
            <Route path="/settings" element={
              <Settings 
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
                />

            } />
            <Route path="/pos" element={
              <Transaksi 
                customers={customers} 
                packages={packages}
                companyInfo={companyInfo}
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

        <Navigation />
      </div>

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
        transaction={receiptToView} 
        companyInfo={companyInfo}
        onClose={() => setReceiptToView(null)} 
        onPrint={handlePrint} 
        btDevice={btDevice}
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
