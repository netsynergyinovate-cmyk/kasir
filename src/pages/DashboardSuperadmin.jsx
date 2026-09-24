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

        {/* Slim Minimalist Executive Header */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                👑 Superadmin
              </span>
              <p className="text-xs font-medium text-slate-500">
                {getGreeting(now.getHours())} · {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Halo, {displayName}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-600 shrink-0" /> Ringkasan operasional {monthLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif &amp; Terpantau
            </span>
          </div>
        </div>

        {/* Executive Financial & Commission Hub */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5 ml-1">
              <Sparkles size={12} className="text-indigo-600" /> Ringkasan Finansial Eksekutif
            </h2>
            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
              Bulan {monthLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Omset Kotor Toko */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between group">
              <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600 absolute top-0 left-0 right-0" />
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <DollarSign size={12} />
                    </span>
                    Omset Kotor Toko
                  </span>
                  <TrendBadge change={comparison.revenueChange} />
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{formatRupiah(financialOverview.grossRevenue)}</p>
              </div>
              <div className="text-[10px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span>{comparison.current.count} transaksi lunas</span>
                <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">Total Kotor</span>
              </div>
            </div>

            {/* Card 2: Hak Komisi Kasir */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between group">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0 right-0" />
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Trophy size={12} />
                    </span>
                    Hak Komisi Kasir
                  </span>
                  <span className="text-[9px] font-extrabold bg-amber-100/70 text-amber-800 px-2 py-0.5 rounded-md">
                    {effectiveAccounts.filter(a => a.role !== 'superadmin').length || 1} Kasir
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">{formatRupiah(financialOverview.totalCommissionLiability)}</p>
              </div>
              <div className="text-[10px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span>Hak Jasa Kasir</span>
                <span className="font-bold text-slate-700">{formatRupiah(companyInfo.adminFee || 10000)}/trx</span>
              </div>
            </div>

            {/* Card 3: Pencairan Komisi (Sudah Cair vs Sisa Pending) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between group">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0 right-0" />
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Wallet size={12} />
                    </span>
                    Komisi Dicairkan
                  </span>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${financialOverview.pendingCommissionBalance > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {financialOverview.pendingCommissionBalance > 0 ? 'Ada Pending' : 'Semua Lunas'}
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">{formatRupiah(financialOverview.totalCommissionPaid)}</p>
              </div>
              <div className="text-[10px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span>Pending:</span>
                <span className="font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                  {formatRupiah(financialOverview.pendingCommissionBalance)}
                </span>
              </div>
            </div>

            {/* Card 4: Estimasi Laba Bersih Toko */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-interactive relative overflow-hidden flex flex-col justify-between group">
              <div className="h-1 bg-gradient-to-r from-purple-600 to-violet-600 absolute top-0 left-0 right-0" />
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <ShieldCheck size={12} />
                    </span>
                    Laba Bersih Toko
                  </span>
                  <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                    Setelah Komisi
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">{formatRupiah(financialOverview.netStoreProfit)}</p>
              </div>
              <div className="text-[10px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span>Margin Toko</span>
                <span className="font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  {financialOverview.grossRevenue > 0 ? `${Math.round((financialOverview.netStoreProfit / financialOverview.grossRevenue) * 100)}%` : '100%'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Quick Actions */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
            <Zap size={12} className="text-amber-500" /> Aksi Cepat Superadmin
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {/* 1. Kasir Baru */}
            <Link
              to="/pos"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-200 group-hover:scale-110 transition-transform">
                <Zap size={18} className="fill-white" />
              </div>
              <span className="text-[11px] font-black text-slate-800 mt-2">Kasir Baru</span>
              <span className="text-[8px] font-bold text-blue-600">POS / Retail</span>
            </Link>

            {/* 2. Pelanggan */}
            <Link
              to="/customers"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-110 transition-transform">
                <Users size={18} />
              </div>
              <span className="text-[11px] font-black text-slate-800 mt-2">Pelanggan</span>
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
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all text-center flex flex-col items-center cursor-pointer"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-110 transition-transform relative">
                <DollarSign size={18} />
                {financialOverview.pendingCommissionBalance > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[11px] font-black text-slate-800 mt-2">Kelola Komisi</span>
              <span className="text-[8px] font-bold text-amber-600">
                {financialOverview.pendingCommissionBalance > 0 ? 'Pencairan' : 'Riwayat'}
              </span>
            </button>

            {/* 4. Rute Lapangan */}
            <Link
              to="/rute"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-purple-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-purple-200 group-hover:scale-110 transition-transform">
                <Navigation2 size={18} />
              </div>
              <span className="text-[11px] font-black text-slate-800 mt-2">Rute &amp; Live</span>
              <span className="text-[8px] font-bold text-purple-600">Pelacakan</span>
            </Link>

            {/* 5. WA Pengingat */}
            <Link
              to="/customers"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-green-200 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-green-200 group-hover:scale-110 transition-transform">
                <MessageCircle size={18} />
              </div>
              <span className="text-[11px] font-black text-slate-800 mt-2">WA Tagihan</span>
              <span className="text-[8px] font-bold text-green-600">{payment.unpaid} Belum Bayar</span>
            </Link>

            {/* 6. Pengaturan Toko */}
            <Link
              to="/settings"
              className="quick-action-tile group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 transition-all text-center flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-600 to-gray-700 text-white flex items-center justify-center shadow-md shadow-slate-200 group-hover:scale-110 transition-transform">
                <Settings size={18} />
              </div>
              <span className="text-[11px] font-black text-slate-800 mt-2">Pengaturan</span>
              <span className="text-[8px] font-bold text-slate-500">Toko &amp; Paket</span>
            </Link>
          </div>
        </div>

        {/* Pendapatan Harian - Transformed into Sculpted Daily Ledger Command Block */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CalendarDays size={13} className="text-indigo-600" /> Pendapatan Harian
              </p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{formatDay(selectedDay)}</p>
            </div>
            <TrendBadge change={dayComparison.revenueChange} />
          </div>

          {/* Segmented Control Pill Switcher */}
          <div className="flex gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/60">
            {[['today', 'Hari Ini'], ['yesterday', 'Kemarin'], ['custom', 'Pilih Tanggal']].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDayMode(mode)}
                className={`flex-1 py-2 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer ${dayMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
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
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
            />
          )}

          {/* Sculpted Hero Cash Highlight Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md">
            <div className="flex items-center justify-between text-[11px] text-indigo-200/80 mb-1">
              <span>Total Uang Masuk</span>
              <span className="font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                {dayComparison.current.count} Transaksi
              </span>
            </div>
            <p className="text-3xl font-black tracking-tight text-white">{formatRupiah(dayComparison.current.revenue)}</p>
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200/70">
              <span>Hari Sebelumnya ({previousDay.getDate()} {MONTHS[previousDay.getMonth()].slice(0, 3)}):</span>
              <span className="font-bold text-white">{formatRupiah(dayComparison.previous.revenue)}</span>
            </div>
          </div>

          {/* Visual Breakdown Uang Masuk per Metode */}
          {methods.length > 0 && (
            <div className="pt-2 space-y-2.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uang masuk per metode</p>
              <div className="space-y-2">
                {methods.map((entry) => {
                  const percent = dayComparison.current.revenue > 0 
                    ? Math.round((entry.revenue / dayComparison.current.revenue) * 100) 
                    : 0;
                  return (
                    <div key={entry.method} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/60 transition-colors space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                          <CreditCard size={12} className="text-indigo-600" />
                          {entry.method} <span className="text-slate-400 font-semibold text-[10px]">· {entry.count} trx</span>
                        </span>
                        <span className="font-black text-slate-900">{formatRupiah(entry.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(4, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buku Kas Harian Collapsible Accordion */}
          <button
            type="button"
            onClick={() => setShowLedger(!showLedger)}
            className="w-full flex items-center justify-between text-[11px] font-extrabold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/80 px-4 py-2.5 rounded-2xl transition-all cursor-pointer border border-indigo-100"
          >
            <span className="flex items-center gap-2">
              <BookOpen size={14} /> Buku kas harian ({ledger.length} transaksi)
            </span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showLedger ? 'rotate-180' : ''}`} />
          </button>

          {showLedger && (
            <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-2 pt-1">
              {ledger.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl">
                  Belum ada uang masuk pada hari ini.
                </p>
              ) : (
                ledger.map((trx) => (
                  <div key={trx.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                        {(trx.customerName || trx.instansiName || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{trx.customerName || trx.instansiName || 'Tanpa nama'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {trx.cashier_name || 'Kasir tidak diketahui'} · {trx.payment_method || 'Tidak dicatat'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
                      {formatRupiah(trx.price)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Omset 7 hari terakhir - Transformed into Sculpted Analytics Bar Deck */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarDays size={13} className="text-indigo-600" /> Omset 7 Hari Terakhir
            </p>
            <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
              7 Hari Berjalan
            </span>
          </div>

          <div className="flex items-end justify-between gap-2 h-28 pt-2">
            {last7Days.map((day) => {
              const isToday = day.date.toDateString() === now.toDateString();
              const heightPercent = Math.max(8, Math.round((day.revenue / maxWeekRevenue) * 100));
              return (
                <div key={day.date.toISOString()} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 group">
                  <span className="text-[9px] font-extrabold text-slate-600 leading-none">
                    {day.revenue > 0 ? formatRupiahCompact(day.revenue) : ''}
                  </span>
                  <div
                    className={`w-full rounded-xl transition-all duration-200 group-hover:scale-105 ${
                      isToday 
                        ? 'bg-gradient-to-t from-indigo-600 to-purple-600 shadow-md shadow-indigo-300 ring-2 ring-indigo-400/50' 
                        : 'bg-indigo-100/90 group-hover:bg-indigo-200'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${formatRupiah(day.revenue)} · ${day.count} trx`}
                  />
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400'}`}>
                    {day.date.getDate()}/{day.date.getMonth() + 1}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Rata-rata harian: <b className="text-slate-800">{formatRupiahCompact(Math.round(last7Days.reduce((sum, d) => sum + d.revenue, 0) / 7))}</b></span>
            <span>Total 7 hari: <b className="font-black text-slate-900">{formatRupiah(last7Days.reduce((sum, d) => sum + d.revenue, 0))}</b></span>
          </div>
        </div>

        {/* KPI: Bulan ini vs bulan lalu - Transformed into Sculpted Executive Matrix */}
        <div className="grid grid-cols-2 gap-3">
          {/* KPI 1: Pendapatan Lunas */}
          <div className="col-span-2 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm card-interactive relative overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Wallet size={13} className="text-indigo-600" /> Pendapatan {MONTHS[now.getMonth()]} (lunas)
              </p>
              <TrendBadge change={comparison.revenueChange} />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1.5 tracking-tight">{formatRupiah(comparison.current.revenue)}</p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Bulan sebelumnya ({previousMonthLabel}):</span>
              <span className="font-bold text-slate-700">{formatRupiah(comparison.previous.revenue)}</span>
            </div>
          </div>

          {/* KPI 2: Transaksi */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-interactive flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Receipt size={12} className="text-indigo-600" /> Transaksi
              </p>
              <TrendBadge change={comparison.countChange} />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{comparison.current.count}</p>
            <p className="text-[10px] text-slate-400 mt-1">{previousMonthLabel}: {comparison.previous.count} trx</p>
          </div>

          {/* KPI 3: Sudah Bayar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm card-interactive flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle size={12} className="text-emerald-600" /> Sudah bayar
              </p>
              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {paidPercent}%
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
              {payment.paid}<span className="text-sm text-slate-400 font-bold"> / {payment.active}</span>
            </p>
            <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${paidPercent}%` }} />
            </div>
          </div>

          {/* KPI 4: Pelanggan Belum Bayar Alert */}
          <div className="col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200/70 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-300/40">
                <AlertCircle size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">
                  {payment.unpaid} pelanggan belum bayar bulan ini
                </p>
                <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                  Dari {payment.active} pelanggan aktif ({100 - paidPercent}%)
                </p>
              </div>
            </div>
            <Link
              to="/customers"
              className="text-[11px] font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-xl shrink-0 transition-colors cursor-pointer"
            >
              Lihat Tagihan
            </Link>
          </div>
        </div>

        {/* Performa Kasir & Hak Komisi - Transformed into Executive Leaderboard Podiums */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 ml-1">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Trophy size={13} className="text-amber-500" /> Performa Kasir &amp; Hak Komisi · {MONTHS[now.getMonth()]}
            </h2>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              Fee Kasir: {formatRupiah(companyInfo.adminFee || 10000)}/trx
            </span>
          </div>

          <div className="space-y-3">
            {cashiers.length === 0 ? (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center text-xs text-slate-400 italic">
                Belum ada transaksi bulan ini.
              </div>
            ) : (
              cashiers.map((cashier, index) => {
                const role = roleByName.get(cashier.name);
                const isSuper = role === 'superadmin';
                const isCS = (cashier.name || '').toLowerCase().includes('cs');

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

                const medalColor = index === 0
                  ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                  : index === 1
                  ? 'bg-slate-300 text-slate-800'
                  : index === 2
                  ? 'bg-orange-300 text-orange-950'
                  : 'bg-slate-100 text-slate-600';

                return (
                  <div
                    key={cashier.name}
                    className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${medalColor}`}>
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate flex items-center gap-1.5">
                            {cashier.name}
                            {isSuper && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                                👑 Super Admin (Non-Komisi)
                              </span>
                            )}
                            {!isSuper && isCS && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                💬 Layanan CS (Non-Komisi)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {cashier.count} transaksi lunas bulan ini
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-900">{formatRupiah(cashier.revenue)}</p>
                        <span className="text-[10px] text-slate-400">Total Omset</span>
                      </div>
                    </div>

                    {/* Revenue Bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                        style={{ width: `${topRevenue > 0 ? Math.max(4, Math.round((cashier.revenue / topRevenue) * 100)) : 0}%` }}
                      />
                    </div>

                    {/* Dedicated Commission Status Capsule */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {isSuper ? (
                        <div className="w-full flex items-center justify-between bg-purple-50/70 p-2.5 rounded-xl border border-purple-100/80">
                          <span className="text-[11px] font-bold text-purple-900">Aturan Akun:</span>
                          <span className="text-[11px] text-purple-700 italic font-semibold">Rp 0 (Super Admin)</span>
                        </div>
                      ) : isCS ? (
                        <div className="w-full flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-800">Kanal Layanan:</span>
                          <span className="text-[11px] text-slate-600 italic font-semibold">Rp 0 (Kanal CS)</span>
                        </div>
                      ) : (
                        <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hak Komisi</span>
                              <span className="font-black text-emerald-600 text-xs">Komisi: {formatRupiah(comm.totalEarned)}</span>
                            </div>
                            <div className="h-6 w-px bg-slate-200" />
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sudah Cair</span>
                              <span className="font-bold text-slate-700 text-xs">Cair: {formatRupiah(comm.totalPaid)}</span>
                            </div>
                            <div className="h-6 w-px bg-slate-200" />
                            <div>
                              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Sisa Pending</span>
                              <span className="font-black text-amber-600 text-xs">Sisa: {formatRupiah(comm.pendingBalance)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCommissionAdmin(matchedAdmin)}
                            className="text-[11px] font-extrabold px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                          >
                            <Send size={11} /> Transfer Komisi
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

        {/* Aktivitas login admin - Transformed into Security & Audit Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between ml-1">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-600" /> Aktivitas Login Terbaru
            </h2>
            <span className="text-[10px] font-bold text-slate-400">Security Audit</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            {accountsLoading ? (
              <p className="text-xs text-slate-400 italic text-center py-3">Memuat aktivitas...</p>
            ) : accounts.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">Belum ada data login.</p>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100 hover:bg-slate-100/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      acc.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {(acc.full_name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                        {acc.full_name}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          acc.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {acc.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </p>
                      {acc.last_login_at ? (
                        <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Smartphone size={11} className="shrink-0 text-slate-400" /> {acc.last_login_device || 'Device tidak diketahui'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="shrink-0 text-slate-400" /> {acc.last_login_location || 'Lokasi tidak diketahui'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">Belum pernah login</p>
                      )}
                    </div>
                  </div>
                  {acc.last_login_at && (
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200/60 px-2.5 py-1 rounded-xl shrink-0 shadow-xs">
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
