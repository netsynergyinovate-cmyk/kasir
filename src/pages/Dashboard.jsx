import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Building2, ChevronLeft, ChevronRight, CheckCircle, Calendar, Target, TrendingUp, DollarSign, ChevronDown } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import './Dashboard.css';

const Dashboard = ({ transactions = [], customers = [], packages = [], companyInfo = {}, setReceiptToView, setInstansiReceiptToView }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [activePaymentTab, setActivePaymentTab] = useState('unpaid');

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Filter for metrics and list
  const filteredTransactions = transactions.filter(trx => {
    const trxDate = new Date(trx.date);
    return trxDate.getMonth() === selectedMonth && trxDate.getFullYear() === selectedYear;
  });

  // 1. Total Potential Target (All active customers' package prices)
  const totalPotentialTarget = customers.reduce((acc, cust) => {
    const pkg = packages.find(p => p.name === cust.package);
    return acc + (pkg ? Number(pkg.price) : 0);
  }, 0);

  // 2. Gross Revenue (Total successful transactions in selected month)
  const grossRevenue = filteredTransactions.reduce((acc, curr) => acc + curr.price, 0);

  // 3. Remaining Target
  const remainingTarget = totalPotentialTarget - grossRevenue;

  // 4. Admin Fee Income (Jasa Kasir)
  // Only for LUNAS transactions that are NOT 'CS'
  const successTrxForAdmin = filteredTransactions.filter(t => 
    (t.status === 'LUNAS' || t.type === 'instansi') && t.payment_method !== 'CS'
  );
  const adminIncome = successTrxForAdmin.length * (companyInfo.adminFee || 10000);

  // Total successful transactions (including CS, needed for progress bar)
  const totalSuccessTrx = filteredTransactions.filter(t => 
    t.status === 'LUNAS' || t.type === 'instansi'
  ).length;

  const totalCustomers = customers.length;
  // Calculate percentage, ensure it doesn't exceed 100% or drop below 0, handle 0 customers
  const progressPercentage = totalCustomers > 0
    ? Math.min(Math.round((totalSuccessTrx / totalCustomers) * 100), 100)
    : 0;

  // Payment status breakdown (active customers only, for the selected month/year)
  const activeCustomers = customers.filter(c => c.status === 'aktif');

  const isPaidThisPeriod = (customer) => filteredTransactions.some(trx =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase()
  );

  const paidCustomers = activeCustomers.filter(isPaidThisPeriod);
  const unpaidCustomers = activeCustomers.filter(c => !isPaidThisPeriod(c));
  const totalActiveCustomers = activeCustomers.length;

  // Latest highlight (within filtered list)
  const latestSuccess = filteredTransactions.find(trx => 
    trx.status === 'LUNAS' || trx.type === 'instansi'
  );

  // Exclude latestSuccess from the paginated list if it exists
  const listTransactions = latestSuccess 
    ? filteredTransactions.filter(t => t.id !== latestSuccess.id)
    : filteredTransactions;

  const totalPages = Math.ceil(listTransactions.length / itemsPerPage);
  const paginatedTrx = listTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="dashboard-container p-4 space-y-6 pb-32 animate-in fade-in duration-300">
      
      {/* Welcome Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight">
            Halo, <span className="text-blue-600">{companyInfo.adminName || 'Admin'}</span> 👋
          </h1>
          <p className="text-gray-500 text-xs font-medium">Laporan ISP KAsir</p>
        </div>
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
          <Users size={24} />
        </div>
      </div>

      {/* Professional Period Filter (Compact) */}
      <div className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-blue-600" />
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periode</h2>
        </div>
        <div className="flex gap-2">
          <div className="relative group">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-gray-50 border border-gray-200 rounded-lg outline-none text-[11px] font-bold text-gray-700 pl-2 pr-7 py-1.5 appearance-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              {months.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          </div>
          <div className="relative group">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-gray-50 border border-gray-200 rounded-lg outline-none text-[11px] font-bold text-gray-700 pl-2 pr-7 py-1.5 appearance-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Target Sisa Card */}
        <div className="bg-indigo-600 p-5 super-rounded text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white opacity-10 rounded-full"></div>
          <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Target Sisa</p>
          <p className="text-lg font-black leading-none">{formatRupiah(remainingTarget > 0 ? remainingTarget : 0)}</p>
          <div className="mt-4 flex items-center gap-1 text-[8px] bg-white/20 w-fit px-2 py-0.5 rounded-full border border-white/10">
             <Target size={8} />
             <span>Ekskl. Pembayaran CS</span>
          </div>
        </div>

        {/* Jasa Admin Card */}
        <div className="bg-emerald-600 p-5 super-rounded text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white opacity-10 rounded-full"></div>
          <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mb-1">Jasa Admin</p>
          <p className="text-lg font-black leading-none">{formatRupiah(adminIncome)}</p>
          <div className="mt-4 flex items-center gap-1 text-[8px] bg-white/20 w-fit px-2 py-0.5 rounded-full border border-white/10">
             <TrendingUp size={8} />
             <span>{successTrxForAdmin.length} Trx Sukses</span>
          </div>
        </div>

        {/* Total Kotor Card */}
        <div className="stat-card p-5 super-rounded flex flex-col justify-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Kotor</p>
          <p className="text-lg font-black text-gray-900">{formatRupiah(grossRevenue)}</p>
          <p className="text-[9px] text-gray-400 mt-1 italic font-medium leading-none">Sebelum Potong Jasa</p>
        </div>

        {/* Progres Penagihan Card */}
        <div className="stat-card p-5 super-rounded flex flex-col justify-center">
          <div className="flex justify-between items-end mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progres Penagihan</p>
            <p className="text-[10px] font-bold text-blue-600">{progressPercentage}%</p>
          </div>
          
          <div className="flex items-baseline gap-1 mb-3">
            <p className="text-2xl font-black text-gray-900 leading-none">{totalSuccessTrx}</p>
            <p className="text-xs font-bold text-gray-400">/ {totalCustomers}</p>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          <p className="text-[9px] text-gray-400 font-medium text-right">
            {totalCustomers - totalSuccessTrx > 0 
              ? `${totalCustomers - totalSuccessTrx} trx belum lunas` 
              : 'Semua lunas! 🎉'}
          </p>
        </div>
      </div>

      {/* Latest Highlight */}
      {latestSuccess && (
        <div className="mt-2">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Transaksi Barusan 🔥</h2>
          <div 
            onClick={() => latestSuccess.type === 'instansi' ? setInstansiReceiptToView(latestSuccess) : setReceiptToView(latestSuccess)}
            className="highlight-card p-5 super-rounded shadow-sm relative cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
                <CheckCircle size={80} className="text-green-600" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                {latestSuccess.type === 'instansi' ? <Building2 size={24}/> : <FileText size={24} />}
              </div>
              <div className="z-10">
                <p className="font-extrabold text-gray-900 text-base leading-tight">
                  {latestSuccess.type === 'instansi' ? latestSuccess.instansiName : latestSuccess.customerName}
                </p>
                <p className="text-[10px] font-bold text-green-600 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  {latestSuccess.payment_method === 'CS' ? 'SUKSES VIA CS' : 'SUKSES BARU SAJA'}
                </p>
              </div>
              <p className="ml-auto font-black text-gray-900 text-base z-10">{formatRupiah(latestSuccess.price)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div>
        <div className="flex justify-between items-center mb-4 ml-1">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Riwayat Terakhir</h2>
          <div className="flex items-center gap-3">
            <Link to="/history" className="text-[10px] text-blue-600 font-bold hover:underline mr-2">Lihat Semua</Link>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="nav-button border border-gray-200"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="nav-button border border-gray-200"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {paginatedTrx.length > 0 ? (
            paginatedTrx.map((trx) => (
              <div 
                key={trx.id} 
                onClick={() => trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx)} 
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trx.type === 'instansi' ? 'bg-gray-50 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                    {trx.type === 'instansi' ? <Building2 size={18}/> : <FileText size={18} />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm leading-tight">{trx.type === 'instansi' ? trx.instansiName : trx.customerName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(trx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} • {trx.payment_method === 'CS' ? 'Bayar CS' : trx.status}</p>
                  </div>
                </div>
                <p className="font-black text-sm text-gray-900">{formatRupiah(trx.price)}</p>
              </div>
            ))
          ) : (
            <div className="py-10 text-center">
              <p className="text-gray-400 text-xs font-medium">Belum ada transaksi</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Halaman {currentPage} dari {totalPages}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
