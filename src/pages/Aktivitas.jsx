import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Calendar, Filter, Server, CheckCircle2, Zap } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { getEbillingLogs } from '../utils/billingApi';
import { useSearchParamSync } from '../hooks/useSearchParamSync';
import { hasPermission } from '../utils/permissions';

const Aktivitas = ({ transactions = [], session }) => {
  const canViewOmset = hasPermission(session?.profile?.role, 'finance.view_omset', session?.profile?.allowed_paths);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem('kasir_aktivitas_tab') || 'kasir';
  });

  useSearchParamSync(setSearchParams, 'tab', activeTab, 'kasir', 'kasir_aktivitas_tab');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cashierFilter, setCashierFilter] = useState('');
  // Log e-billing dibaca ulang dari localStorage setiap kali tab berpindah
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ebillingLogs = useMemo(() => getEbillingLogs(), [activeTab]);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const filteredByPeriod = transactions.filter(trx => {
    const trxDate = new Date(trx.date);
    const matchesMonth = trxDate.getMonth() === Number(selectedMonth);
    const matchesYear = trxDate.getFullYear() === Number(selectedYear);
    const matchesDay = selectedDay === 'all' || trxDate.getDate() === Number(selectedDay);
    return matchesMonth && matchesYear && matchesDay;
  });

  const filteredTransactions = cashierFilter
    ? filteredByPeriod.filter(trx => (trx.cashierName || '').toLowerCase().includes(cashierFilter.toLowerCase()))
    : filteredByPeriod;

  const cashierSummary = filteredByPeriod.reduce((acc, trx) => {
    const name = trx.cashierName || 'Tanpa Nama';
    if (!acc[name]) acc[name] = { count: 0, total: 0 };
    acc[name].count += 1;
    acc[name].total += trx.price;
    return acc;
  }, {});

  const cashierSummaryList = Object.entries(cashierSummary)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200 web:pb-8 web:space-y-5">
      <div className="flex justify-between items-center mb-1 web:hidden">
        <h2 className="text-xl font-bold text-gray-800">Aktivitas & Log System</h2>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-2xl web:inline-flex">
        <button 
          onClick={() => setActiveTab('kasir')} 
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all web:px-6 ${activeTab === 'kasir' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          Aktivitas Kasir
        </button>
        <button 
          onClick={() => setActiveTab('ebilling')} 
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 web:px-6 ${activeTab === 'ebilling' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <Server size={14} /> Log E-Billing {ebillingLogs.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{ebillingLogs.length}</span>}
        </button>
      </div>

      {activeTab === 'ebilling' ? (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-2xl text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Integrasi Automasi Kasir</p>
                <h3 className="text-lg font-black mt-0.5">Log Pengiriman ke E-Billing</h3>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
                <Zap size={20} className="text-amber-300 fill-amber-300" />
              </div>
            </div>
            <p className="text-[11px] text-blue-100 mt-2">Setiap kali transaksi kasir lunas, data otomatis dikirim dan dicatat di sini.</p>
          </div>

          {/* Web: tabel log e-billing */}
          {ebillingLogs.length > 0 && (
            <div className="hidden web:block max-h-[calc(100vh-20rem)] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr>
                    {[
                      ['Waktu', ''], ['Pelanggan', ''], ['Kasir', ''], ['Paket', ''],
                      ['Nominal', 'text-right'], ['Status', ''], ['ID Transaksi', ''], ['Token', ''],
                    ].map(([label, align]) => (
                      <th
                        key={label}
                        className={`sticky top-0 z-[5] border-b border-gray-200 bg-gray-50 px-3 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500 first:rounded-tl-2xl last:rounded-tr-2xl ${align}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ebillingLogs.map(log => (
                    <tr key={log.id} className="border-b border-gray-100 last:border-b-0 align-middle transition-colors hover:bg-blue-50/50">
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-500">{log.dateFormatted}</td>
                      <td className="px-3 py-2.5 font-bold text-blue-700">{log.customer_name}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{log.cashier_name}</td>
                      <td className="px-3 py-2.5 text-gray-600">{log.package_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-black text-gray-900 whitespace-nowrap">{formatRupiah(log.price)}</td>
                      <td className="px-3 py-2.5">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px] px-2.5 py-1 rounded-xl inline-flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-600" /> {log.response_code}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">{log.trx_id}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-400">{log.api_key_used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={`space-y-2${ebillingLogs.length > 0 ? ' web:hidden' : ''}`}>
            {ebillingLogs.length > 0 ? (
              ebillingLogs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-700">{log.customer_name}</span>
                    <span className="text-[10px] font-mono text-gray-400">{log.dateFormatted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Kasir: <strong className="text-gray-800">{log.cashier_name}</strong></p>
                      <p className="text-xs font-bold text-gray-900 mt-0.5">{formatRupiah(log.price)} ({log.package_name})</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px] px-2.5 py-1 rounded-xl flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-600" /> {log.response_code}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-mono">
                    <span>ID: {log.trx_id}</span>
                    <span>Token: {log.api_key_used}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 bg-white rounded-2xl border border-gray-100 text-center">
                <Server size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500 font-bold">Belum Ada Log Pengiriman E-Billing</p>
                <p className="text-[11px] text-gray-400 mt-1">Selesaikan transaksi di kasir untuk melihat log pengiriman real-time.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3 web:flex web:flex-wrap web:items-center web:gap-3 web:space-y-0">
            <div className="grid grid-cols-3 gap-2 web:w-[460px]">
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

            <div className="bg-gray-50 flex items-center p-2 rounded-xl border border-gray-100 web:flex-1 web:min-w-[240px]">
              <Search size={18} className="text-gray-400 ml-1" />
              <input
                type="text"
                placeholder="Cari nama kasir..."
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="bg-transparent border-none outline-none p-2 w-full text-xs font-medium"
              />
            </div>
          </div>

          {canViewOmset && cashierSummaryList.length > 0 && (
            <div className="grid grid-cols-2 gap-3 web:grid-cols-4 web:gap-4">
              {cashierSummaryList.map(c => (
                <div key={c.name} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 truncate">{c.name}</p>
                  <p className="text-lg font-black text-gray-900">{formatRupiah(c.total)}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{c.count} transaksi</p>
                </div>
              ))}
            </div>
          )}

          {/* Web: tabel aktivitas kasir */}
          {filteredTransactions.length > 0 && (
            <div className="hidden web:block max-h-[calc(100vh-20rem)] overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr>
                    {[
                      ['Tanggal', ''], ['Jam', ''], ['Kasir', ''], ['Pelanggan / Instansi', ''], ['Nominal', 'text-right'],
                    ].map(([label, align]) => (
                      <th
                        key={label}
                        className={`sticky top-0 z-[5] border-b border-gray-200 bg-gray-50 px-3 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500 first:rounded-tl-2xl last:rounded-tr-2xl ${align}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((trx) => (
                    <tr key={trx.id} className="border-b border-gray-100 last:border-b-0 align-middle transition-colors hover:bg-blue-50/50">
                      <td className="px-3 py-2.5 whitespace-nowrap font-bold text-gray-800">
                        {new Date(trx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">
                        {new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5 font-black text-blue-700">{trx.cashierName || 'Tanpa Nama'}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-800">
                        {trx.type === 'instansi' ? trx.instansiName : trx.customerName}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-black text-gray-900 whitespace-nowrap">{formatRupiah(trx.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={`space-y-3 mt-2${filteredTransactions.length > 0 ? ' web:hidden' : ''}`}>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((trx) => (
                <div key={trx.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-blue-700">{trx.cashierName || 'Tanpa Nama'}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(trx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' '}
                      {new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800">
                      {trx.type === 'instansi' ? trx.instansiName : trx.customerName}
                    </p>
                    <p className="font-black text-sm text-gray-900">{formatRupiah(trx.price)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center bg-white rounded-2xl border border-gray-100">
                <p className="text-gray-400 text-xs font-medium">Tidak ada aktivitas pada periode ini</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Aktivitas;
