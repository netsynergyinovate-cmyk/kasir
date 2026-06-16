import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Building2, ChevronLeft, ChevronRight, CheckCircle, Calendar } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import './Dashboard.css';

const Dashboard = ({ transactions, customers, setReceiptToView, setInstansiReceiptToView }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Filter for income calculation
  const filteredTransactions = transactions.filter(trx => {
    const trxDate = new Date(trx.date);
    return trxDate.getMonth() === selectedMonth && trxDate.getFullYear() === selectedYear;
  });

  const monthlyIncome = filteredTransactions.reduce((acc, curr) => acc + curr.price, 0);

  // Get the single latest successful transaction for the highlight (within selected month)
  const latestSuccess = filteredTransactions.find(trx => 
    trx.status === 'LUNAS' || trx.type === 'instansi'
  );

  // Exclude latestSuccess from the paginated list if it exists (within filtered list)
  const listTransactions = latestSuccess 
    ? filteredTransactions.filter(t => t.id !== latestSuccess.id)
    : filteredTransactions;

  const totalPages = Math.ceil(listTransactions.length / itemsPerPage);
  const paginatedTrx = listTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="dashboard-container p-4 space-y-6 pb-32 animate-in fade-in duration-300">
      {/* Header & Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-gradient p-5 super-rounded text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white opacity-10 rounded-full"></div>
          <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">Pendapatan {months[selectedMonth]}</p>
          <p className="text-xl font-black">{formatRupiah(monthlyIncome)}</p>
          <div className="mt-4 flex items-center gap-1 text-[9px] bg-white/20 w-fit px-2 py-1 rounded-full border border-white/20">
             <Calendar size={10} />
             <span>{months[selectedMonth]} {selectedYear}</span>
          </div>
        </div>
        <div className="stat-card p-5 super-rounded flex flex-col justify-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Pelanggan</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <p className="text-2xl font-black text-gray-900">{customers.length}</p>
          </div>
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
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm">
                {latestSuccess.type === 'instansi' ? <Building2 size={24}/> : <FileText size={24} />}
              </div>
              <div className="z-10">
                <p className="font-extrabold text-gray-900 text-base leading-tight">
                  {latestSuccess.type === 'instansi' ? latestSuccess.instansiName : latestSuccess.customerName}
                </p>
                <p className="text-[10px] font-bold text-green-600 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  SUKSES BARU SAJA
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

        <div className="space-y-3">
          {paginatedTrx.length > 0 ? (
            paginatedTrx.map((trx) => (
              <div 
                key={trx.id} 
                onClick={() => trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx)} 
                className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${trx.type === 'instansi' ? 'bg-gray-50 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                    {trx.type === 'instansi' ? <Building2 size={18}/> : <FileText size={18} />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm leading-tight">{trx.type === 'instansi' ? trx.instansiName : trx.customerName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(trx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} • {trx.type === 'instansi' ? 'Instansi' : trx.status}</p>
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
