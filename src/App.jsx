import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Menu, Building2, RefreshCw } from 'lucide-react';
import { supabase, testConnection } from './lib/supabase';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Pelanggan from './pages/Pelanggan';
import Transaksi from './pages/Transaksi';
import Settings from './pages/Settings';
import Instansi from './pages/Instansi';
import History from './pages/History';
import AddCustomerModal from './components/AddCustomerModal';
import ReceiptThermal from './components/ReceiptThermal';
import ReceiptA4 from './components/ReceiptA4';

const INIT_COMPANY = {
  name: 'PT Net Synergy Inovate',
  address: 'Loading...',
  phone: '',
  logo: null
};

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  const [savedDeviceName, setSavedDeviceName] = useState(localStorage.getItem('last_printer_name') || '');

  useEffect(() => {
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
          setCompanyInfo({
            name: settingsData.name,
            address: settingsData.address,
            phone: settingsData.phone,
            logo: settingsData.logo_url
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
  }, []);

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

  const handleTransactionComplete = async (newTrx) => {
    try {
      console.log('Menyimpan Transaksi Retail...');
      const { error } = await supabase.from('transactions').insert([{
        id: newTrx.id,
        date: newTrx.date,
        customer_name: newTrx.customerName,
        package_name: newTrx.packageName,
        price: newTrx.price,
        status: newTrx.status,
        payment_method: newTrx.paymentMethod,
        amount_paid: newTrx.amountPaid,
        cashier_name: newTrx.cashierName,
        type: 'retail'
      }]);

      if (error) throw error;
      setTransactions([newTrx, ...transactions]);
      setReceiptToView(newTrx);
      console.log('Transaksi berhasil disimpan ke database.');
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
    } catch (e) {
      alert('Gagal menyimpan invoice: ' + e.message);
    }
  };

  const handleAddCustomer = async (newCust) => {
    try {
      const { error } = await supabase.from('customers').insert([{
        id: newCust.id,
        name: newCust.name,
        address: newCust.address,
        package: newCust.package,
        due_date: newCust.dueDate,
        status: 'aktif'
      }]);

      if (error) throw error;
      setCustomers([newCust, ...customers]);
      setShowAddCustomer(false);
    } catch (e) {
      alert('Gagal menambah pelanggan: ' + e.message);
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try {
      const { error } = await supabase.from('company_settings').upsert({
        id: 1,
        name: newSettings.name,
        address: newSettings.address,
        phone: newSettings.phone,
        logo_url: newSettings.logo
      });
      if (error) throw error;
      setCompanyInfo(newSettings);
    } catch (e) {
      console.error('Error updating settings:', e);
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
        <RefreshCw className="animate-spin mb-4" size={40} />
        <p className="font-bold animate-pulse">Menghubungkan ke Supabase...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans ${receiptToView || instansiReceiptToView ? 'print-container' : ''}`}>
      
      <div className="flex-1 relative flex flex-col print:hidden">
        
        <header className="bg-white px-4 py-3.5 border-b border-gray-100 sticky top-0 z-10 flex items-center gap-3 shrink-0">
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
                setShowAddCustomer={setShowAddCustomer} 
                onDeleteCustomer={handleDeleteCustomerDB}
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
                savedDeviceName={savedDeviceName}
              />
            } />
            <Route path="/pos" element={
              <Transaksi 
                customers={customers} 
                packages={packages}
                onComplete={handleTransactionComplete} 
              />
            } />
            <Route path="/instansi" element={
               <Instansi onComplete={handleInstansiComplete} />
            } />
          </Routes>
        </main>

        <Navigation />
      </div>

      <AddCustomerModal 
        show={showAddCustomer} 
        packages={packages}
        onClose={() => setShowAddCustomer(false)} 
        onAdd={handleAddCustomer} 
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
