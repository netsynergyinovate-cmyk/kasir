import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Minus, Wallet, CalendarDays, BookOpen, ChevronDown, 
  Receipt, CheckCircle, AlertCircle, Trophy, Clock, Smartphone, MapPin, ShieldCheck,
  Zap, Users, Settings, Send, MessageCircle, DollarSign, Sparkles, Navigation2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatRupiah, formatRupiahCompact } from '../utils/format';
import { getGreeting, compareMonths, cashierPerformance, paymentSummary, formatRelativeTime, compareDays, resolveDay, methodBreakdown, dailyTransactions, toInputValue, weeklyRevenue } from '../utils/dashboardStats';
import { calculateStoreFinancialOverview, calculateAdminCommissions } from '../utils/commissions';
import { normalizeAdminAccess } from '../utils/permissions';
import AdminCommissionModal from '../components/AdminCommissionModal';
import Dashboard from './Dashboard';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TrendBadge = ({ change }) => {
  if (change === null) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Baru</span>;
  }
  if (change === 0) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 inline-flex items-center gap-0.5">
        <Minus size={10} /> 0%
      </span>
    );
  }
  const up = change > 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {up ? '+' : ''}{change}%
    </span>
  );
};

const DashboardSuperadmin = (props) => {
  const { transactions = [], customers = [], session, companyInfo = {} } = props;
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [roleByName, setRoleByName] = useState(new Map());
  const [selectedCommissionAdmin, setSelectedCommissionAdmin] = useState(null);
  const [dayMode, setDayMode] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [showLedger, setShowLedger] = useState(false);

  const fetchAccounts = useCallback(() => {
    supabase
      .from('admin_profiles')
      .select('id, full_name, email, role, allowed_paths, last_login_at, last_login_device, last_login_location')
      .order('last_login_at', { ascending: false, nullsFirst: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error && data) setAccounts(data);
        setAccountsLoading(false);
      });

    // Daftar lengkap untuk kalkulasi komisi seluruh admin & pencocokan nama
    supabase
      .from('admin_profiles')
      .select('id, full_name, email, role, allowed_paths')
      .then(({ data, error }) => {
        if (error || !data) return;
        setAllAccounts(data);
        setRoleByName(new Map(data.map((p) => [p.full_name, p.role])));
      });
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const previousMonthLabel = MONTHS[(now.getMonth() + 11) % 12];
  const selectedDay = resolveDay(dayMode, now, customDate);
  const previousDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() - 1);
  const dayComparison = compareDays(transactions, selectedDay);
  const formatDay = (date) => date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayInputValue = toInputValue(now);
  const methods = methodBreakdown(transactions, selectedDay);
  const ledger = dailyTransactions(transactions, selectedDay);
  const displayName = session?.profile?.full_name || 'Super Administrator';

  const last7Days = weeklyRevenue(transactions, now, 7);
  const maxWeekRevenue = Math.max(...last7Days.map((d) => d.revenue), 1);

  const comparison = compareMonths(transactions, now);
  const cashiers = cashierPerformance(transactions, now.getFullYear(), now.getMonth());
  const topRevenue = cashiers.length > 0 ? cashiers[0].revenue : 0;
  const payment = paymentSummary(customers, transactions, now);
  const paidPercent = payment.active > 0 ? Math.round((payment.paid / payment.active) * 100) : 0;

  const effectiveAccounts = allAccounts.length > 0 
    ? allAccounts 
    : cashiers
        .filter(c => !((c.name || '').toLowerCase().includes('cs') || roleByName.get(c.name) === 'superadmin'))
        .map(c => ({ id: c.name, full_name: c.name, role: 'admin', allowed_paths: {} }));

  const financialOverview = calculateStoreFinancialOverview(
    transactions,
    effectiveAccounts,
    companyInfo.adminFee || 10000,
    now
  );

  return (
    <div className="pb-32 animate-in fade-in duration-300">
      <div className="p-4 space-y-6">

        {/* Hero sapaan */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-5 text-white shadow-lg shadow-indigo-200">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-[-2.5rem] w-24 h-24 rounded-full bg-white/10" />
          <div className="relative">
            <p className="text-[11px] font-bold text-indigo-100">
              {getGreeting(now.getHours())} · {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-2xl font-black leading-tight mt-1">Halo, {displayName} 👋</h1>
            <p className="text-xs text-indigo-100 mt-1 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Ringkasan operasional {monthLabel}
            </p>
          </div>
        </div>

        {/* Executive Financial & Commission Hub */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5 ml-1">
              <Sparkles size={12} className="text-indigo-600" /> Ringkasan Finansial Eksekutif
            </h2>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Bulan {monthLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Omset Kotor Toko */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <DollarSign size={13} className="text-indigo-600" /> Omset Kotor Toko
                </span>
                <TrendBadge change={comparison.revenueChange} />
              </div>
              <p className="text-xl font-black text-gray-900 mt-1">{formatRupiah(financialOverview.grossRevenue)}</p>
              <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                <span>{comparison.current.count} trx lunas</span>
                <span className="font-semibold text-indigo-600">Total Kotor</span>
              </p>
            </div>

            {/* Card 2: Hak Komisi Kasir */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                  <Trophy size={13} /> Hak Komisi Kasir
                </span>
                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md">
                  {effectiveAccounts.filter(a => a.role !== 'superadmin').length || 1} Kasir
                </span>
              </div>
              <p className="text-xl font-black text-amber-600 mt-1">{formatRupiah(financialOverview.totalCommissionLiability)}</p>
              <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                <span>Hak Jasa Kasir</span>
                <span className="font-semibold text-gray-700">{formatRupiah(companyInfo.adminFee || 10000)}/trx</span>
              </p>
            </div>

            {/* Card 3: Pencairan Komisi (Sudah Cair vs Sisa Pending) */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                  <Wallet size={13} /> Komisi Dicairkan
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${financialOverview.pendingCommissionBalance > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {financialOverview.pendingCommissionBalance > 0 ? 'Ada Pending' : 'Semua Lunas'}
                </span>
              </div>
              <p className="text-xl font-black text-emerald-600 mt-1">{formatRupiah(financialOverview.totalCommissionPaid)}</p>
              <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                <span>Pending:</span>
                <span className="font-black text-amber-600">{formatRupiah(financialOverview.pendingCommissionBalance)}</span>
              </p>
            </div>

            {/* Card 4: Estimasi Laba Bersih Toko */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck size={13} /> Laba Bersih Toko
                </span>
                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md">
                  Setelah Komisi
                </span>
              </div>
              <p className="text-xl font-black text-indigo-900 mt-1">{formatRupiah(financialOverview.netStoreProfit)}</p>
              <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                <span>Margin Toko</span>
                <span className="font-semibold text-emerald-600">
                  {financialOverview.grossRevenue > 0 ? `${Math.round((financialOverview.netStoreProfit / financialOverview.grossRevenue) * 100)}%` : '100%'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Executive Quick Actions */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
            <Zap size={12} className="text-amber-500" /> Aksi Cepat Superadmin
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {/* 1. Kasir Baru */}
            <Link
              to="/pos"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-200 group-hover:scale-110 transition-transform">
                <Zap size={18} className="fill-white" />
              </div>
              <span className="text-[11px] font-black text-gray-800 mt-2">Kasir Baru</span>
              <span className="text-[8px] font-bold text-blue-600">POS / Retail</span>
            </Link>

            {/* 2. Pelanggan */}
            <Link
              to="/customers"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-110 transition-transform">
                <Users size={18} />
              </div>
              <span className="text-[11px] font-black text-gray-800 mt-2">Pelanggan</span>
              <span className="text-[8px] font-bold text-emerald-600">{customers.length} Terdaftar</span>
            </Link>

            {/* 3. Kelola Komisi */}
            <button
              type="button"
              onClick={() => {
                const defaultTarget = effectiveAccounts.find(a => a.role !== 'superadmin') || {
                  id: 'adm-wahyu',
                  full_name: 'Admin Wahyu',
                  role: 'admin',
                  allowed_paths: {}
                };
                setSelectedCommissionAdmin(defaultTarget);
              }}
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-amber-200 transition-all text-center flex flex-col items-center cursor-pointer"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-110 transition-transform relative">
                <DollarSign size={18} />
                {financialOverview.pendingCommissionBalance > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[11px] font-black text-gray-800 mt-2">Kelola Komisi</span>
              <span className="text-[8px] font-bold text-amber-600">
                {financialOverview.pendingCommissionBalance > 0 ? 'Pencairan' : 'Riwayat'}
              </span>
            </button>

            {/* 4. Rute Lapangan */}
            <Link
              to="/rute"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-purple-200 group-hover:scale-110 transition-transform">
                <Navigation2 size={18} />
              </div>
              <span className="text-[11px] font-black text-gray-800 mt-2">Rute &amp; Live</span>
              <span className="text-[8px] font-bold text-purple-600">Pelacakan</span>
            </Link>

            {/* 5. WA Pengingat */}
            <Link
              to="/customers"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-green-200 group-hover:scale-110 transition-transform">
                <MessageCircle size={18} />
              </div>
              <span className="text-[11px] font-black text-gray-800 mt-2">WA Tagihan</span>
              <span className="text-[8px] font-bold text-green-600">{payment.unpaid} Belum Bayar</span>
            </Link>

            {/* 6. Pengaturan Toko */}
            <Link
              to="/settings"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-gray-300 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-600 to-gray-700 text-white flex items-center justify-center shadow-md shadow-gray-200 group-hover:scale-110 transition-transform">
                <Settings size={18} />
              </div>
              <span className="text-[11px] font-black text-gray-800 mt-2">Pengaturan</span>
              <span className="text-[8px] font-bold text-gray-500">Toko &amp; Paket</span>
            </Link>
          </div>
        </div>

        {/* Pendapatan harian: toggle Hari Ini / Kemarin / pilih tanggal */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarDays size={12} /> Pendapatan Harian
            </p>
            <TrendBadge change={dayComparison.revenueChange} />
          </div>

          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
            {[['today', 'Hari Ini'], ['yesterday', 'Kemarin'], ['custom', 'Pilih Tanggal']].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDayMode(mode)}
                className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${dayMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {dayMode === 'custom' && (
            <input
              type="date"
              value={customDate}
              max={todayInputValue}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-indigo-500"
            />
          )}

          <div>
            <p className="text-[11px] font-bold text-gray-500">{formatDay(selectedDay)}</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{formatRupiah(dayComparison.current.revenue)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {dayComparison.current.count} transaksi lunas · hari sebelumnya ({previousDay.getDate()} {MONTHS[previousDay.getMonth()].slice(0, 3)}): {formatRupiah(dayComparison.previous.revenue)}
            </p>
          </div>

          {methods.length > 0 && (
            <div className="pt-3 border-t border-gray-100 space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Uang masuk per metode</p>
              {methods.map((entry) => (
                <div key={entry.method} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">{entry.method} <span className="text-gray-400 font-medium">· {entry.count} trx</span></span>
                  <span className="font-black text-gray-900">{formatRupiah(entry.revenue)}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowLedger(!showLedger)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-1.5"><BookOpen size={13} /> Buku kas harian ({ledger.length} transaksi)</span>
            <ChevronDown size={14} className={`transition-transform ${showLedger ? 'rotate-180' : ''}`} />
          </button>

          {showLedger && (
            <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1.5">
              {ledger.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-3">Belum ada uang masuk pada hari ini.</p>
              ) : (
                ledger.map((trx) => (
                  <div key={trx.id} className="flex items-start justify-between gap-2 p-2.5 bg-gray-50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{trx.customerName || trx.instansiName || 'Tanpa nama'}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {trx.cashier_name || 'Kasir tidak diketahui'} · {trx.payment_method || 'Tidak dicatat'}
                      </p>
                    </div>
                    <span className="text-xs font-black text-emerald-600 shrink-0">{formatRupiah(trx.price)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Omset 7 hari terakhir */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
            <CalendarDays size={12} /> Omset 7 Hari Terakhir
          </p>
          <div className="flex items-end justify-between gap-1.5 h-24">
            {last7Days.map((day) => {
              const isToday = day.date.toDateString() === now.toDateString();
              const heightPercent = Math.max(6, Math.round((day.revenue / maxWeekRevenue) * 100));
              return (
                <div key={day.date.toISOString()} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-[9px] font-bold text-gray-500 leading-none">{day.revenue > 0 ? formatRupiahCompact(day.revenue) : ''}</span>
                  <div
                    className={`w-full rounded-md ${isToday ? 'bg-indigo-600' : 'bg-indigo-200'}`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${formatRupiah(day.revenue)} · ${day.count} trx`}
                  />
                  <span className={`text-[9px] font-bold ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{day.date.getDate()}/{day.date.getMonth() + 1}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500 mt-3 text-center">
            Total 7 hari: <span className="font-black text-gray-800">{formatRupiah(last7Days.reduce((sum, d) => sum + d.revenue, 0))}</span>
          </p>
        </div>

        {/* KPI: bulan ini vs bulan lalu */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Wallet size={12} /> Pendapatan {MONTHS[now.getMonth()]} (lunas)
              </p>
              <TrendBadge change={comparison.revenueChange} />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-1">{formatRupiah(comparison.current.revenue)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{previousMonthLabel}: {formatRupiah(comparison.previous.revenue)}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Receipt size={12} /> Transaksi</p>
              <TrendBadge change={comparison.countChange} />
            </div>
            <p className="text-xl font-black text-gray-900 mt-1">{comparison.current.count}</p>
            <p className="text-[11px] text-gray-500">{previousMonthLabel}: {comparison.previous.count}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm card-interactive">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle size={12} /> Sudah bayar</p>
            <p className="text-xl font-black text-emerald-600 mt-1">{payment.paid}<span className="text-sm text-gray-400 font-bold"> / {payment.active}</span></p>
            <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paidPercent}%` }} />
            </div>
          </div>

          <div className="col-span-2 bg-amber-50 p-3.5 rounded-2xl border border-amber-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><AlertCircle size={18} /></div>
            <div>
              <p className="text-sm font-black text-gray-900">{payment.unpaid} pelanggan belum bayar bulan ini</p>
              <p className="text-[11px] text-gray-500">Dari {payment.active} pelanggan aktif ({100 - paidPercent}%)</p>
            </div>
          </div>
        </div>

        {/* Performa per kasir + komisi yang harus dibayar ke tiap admin */}
        <div>
          <div className="flex items-center justify-between mb-3 ml-1">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Trophy size={12} /> Performa Kasir &amp; Hak Komisi · {MONTHS[now.getMonth()]}
            </h2>
            <span className="text-[10px] font-bold text-gray-400">
              Fee Kasir: {formatRupiah(companyInfo.adminFee || 10000)}/trx
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            {cashiers.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">Belum ada transaksi bulan ini.</p>
            ) : (
              cashiers.map((cashier, index) => {
                const role = roleByName.get(cashier.name);
                const isSuper = role === 'superadmin';
                const isCS = (cashier.name || '').toLowerCase().includes('cs');

                // Cari data admin jika ada, atau buat fallback admin object
                const matchedAdmin = effectiveAccounts.find(
                  (a) => (a.full_name || '').toLowerCase() === cashier.name.toLowerCase()
                ) || {
                  id: cashier.name,
                  full_name: cashier.name,
                  role: isSuper ? 'superadmin' : 'admin',
                  allowed_paths: {},
                };

                const currentAccess = normalizeAdminAccess(matchedAdmin.allowed_paths);
                const comm = calculateAdminCommissions(
                  transactions,
                  matchedAdmin.id,
                  cashier.name,
                  companyInfo.adminFee || 10000,
                  currentAccess.commissions || [],
                  isSuper ? 'superadmin' : 'admin'
                );

                return (
                  <div key={cashier.name} className="p-3 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-black text-gray-400 w-5">#{index + 1}</span>
                        <p className="text-xs font-bold text-gray-800 truncate">{cashier.name}</p>
                        {isSuper && (
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            👑 Super Admin (Non-Komisi)
                          </span>
                        )}
                        {!isSuper && isCS && (
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            💬 Layanan CS (Non-Komisi)
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black text-gray-900 shrink-0">{formatRupiah(cashier.revenue)}</p>
                    </div>

                    <div className="h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${topRevenue > 0 ? Math.max(4, Math.round((cashier.revenue / topRevenue) * 100)) : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/50">
                      <span className="text-gray-500 font-medium">{cashier.count} transaksi lunas</span>
                      {isSuper ? (
                        <span className="text-gray-400 italic">Rp 0 (Super Admin)</span>
                      ) : isCS ? (
                        <span className="text-gray-400 italic">Rp 0 (Kanal CS)</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-700">
                            Komisi: <b className="text-emerald-600 font-black">{formatRupiah(comm.totalEarned)}</b>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-500">
                            Cair: <b className="text-emerald-700">{formatRupiah(comm.totalPaid)}</b>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-500">
                            Sisa: <b className="text-amber-600 font-black">{formatRupiah(comm.pendingBalance)}</b>
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedCommissionAdmin(matchedAdmin)}
                            className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <Send size={10} /> Transfer Komisi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Aktivitas login admin */}
        <div>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-1.5">
            <Clock size={12} /> Aktivitas Login Terbaru
          </h2>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            {accountsLoading ? (
              <p className="text-xs text-gray-400 italic text-center py-2">Memuat aktivitas...</p>
            ) : accounts.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">Belum ada data login.</p>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex items-start justify-between gap-2 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate flex items-center gap-1.5">
                      {acc.full_name}
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${acc.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {acc.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </p>
                    {acc.last_login_at ? (
                      <div className="text-[11px] text-gray-500 mt-0.5 space-y-0.5">
                        <p className="flex items-center gap-1"><Smartphone size={11} className="shrink-0" /> {acc.last_login_device || 'Device tidak diketahui'}</p>
                        <p className="flex items-center gap-1"><MapPin size={11} className="shrink-0" /> {acc.last_login_location || 'Lokasi tidak diketahui'}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-0.5">Belum pernah login</p>
                    )}
                  </div>
                  {acc.last_login_at && (
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg shrink-0">
                      {formatRelativeTime(acc.last_login_at, now)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Detail Lengkap</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>

      <Dashboard {...props} hideHeader canManageRoute />

      {/* Modal Transfer Komisi Kasir */}
      {selectedCommissionAdmin && (
        <AdminCommissionModal
          admin={selectedCommissionAdmin}
          transactions={transactions}
          companyInfo={companyInfo}
          session={session}
          onClose={() => setSelectedCommissionAdmin(null)}
          onSaved={() => {
            fetchAccounts();
            setSelectedCommissionAdmin(null);
          }}
        />
      )}
    </div>
  );
};

export default DashboardSuperadmin;
