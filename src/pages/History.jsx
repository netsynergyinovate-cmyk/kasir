import { useState } from 'react';
import { Search, Calendar, Filter, FileText, Building2, ChevronRight, Trash2 } from 'lucide-react';
import { formatRupiah } from '../utils/format';

const History = ({ transactions, role, setReceiptToView, setInstansiReceiptToView, onDeleteTransaction }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const filteredTransactions = transactions.filter(trx => {
    const trxDate = new Date(trx.date);
    const matchesSearch = 
      (trx.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trx.instansiName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMonth = trxDate.getMonth() === Number(selectedMonth);
    const matchesYear = trxDate.getFullYear() === Number(selectedYear);
    const matchesDay = selectedDay === 'all' || trxDate.getDate() === Number(selectedDay);

    return matchesSearch && matchesMonth && matchesYear && matchesDay;
  });

  const totalIncome = filteredTransactions.reduce((acc, curr) => acc + curr.price, 0);

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Riwayat Transaksi</h2>
      </div>

      {/* Stats Summary for Filtered Data */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Pendapatan Filter</p>
        <p className="text-2xl font-black text-blue-600">{formatRupiah(totalIncome)}</p>
        <p className="text-[10px] text-gray-500 mt-1 font-medium italic">
          {selectedDay !== 'all' ? `${selectedDay} ` : ''}{months[selectedMonth]} {selectedYear} • {filteredTransactions.length} Transaksi
        </p>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 flex items-center p-2 rounded-xl border border-gray-100">
            <Search size={18} className="text-gray-400 ml-1" />
            <input 
              type="text" 
              placeholder="Cari nama/ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none p-2 w-full text-xs font-medium" 
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <select 
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-9"
            >
              <option value="all">Semua Hari</option>
              {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
          </div>

          <div className="relative">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-9"
            >
              {months.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
          </div>

          <div className="relative">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-9"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3 mt-2">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((trx) => (
            <div 
              key={trx.id} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden active:scale-[0.98]"
              onClick={() => trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx)} 
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400">{trx.id}</span>
                  {trx.type !== 'instansi' && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${trx.status === 'LUNAS' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {trx.status}
                    </span>
                  )}
                </div>
                
                {/* Tombol Hapus (khusus superadmin; admin hanya bisa melihat) */}
                {role === 'superadmin' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Hapus permanen riwayat transaksi ini?')) {
                        onDeleteTransaction(trx.id);
                      }
                    }}
                    className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${trx.type === 'instansi' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600'}`}>
                  {trx.type === 'instansi' ? <Building2 size={18}/> : <FileText size={18} />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm leading-tight">
                    {trx.type === 'instansi' ? trx.instansiName : trx.customerName}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(trx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-blue-700 text-sm">{formatRupiah(trx.price)}</p>
                  <ChevronRight size={14} className="text-gray-300 ml-auto mt-1" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center space-y-3">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                <Search size={30} className="text-gray-200" />
             </div>
             <p className="text-gray-400 text-sm font-medium">Tidak ada transaksi ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
