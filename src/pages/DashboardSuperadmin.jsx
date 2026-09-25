import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Minus, CalendarDays, BookOpen, ChevronDown, ChevronLeft, ChevronRight,
  Trophy, Clock, Smartphone, MapPin, Zap, Users, Settings, Send, MessageCircle, DollarSign,
  Navigation2, FolderKanban, CreditCard, ChartColumn, Target, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatRupiah, formatRupiahCompact } from '../utils/format';
import {
  getGreeting, compareMonths, cashierPerformance, paymentBreakdown, formatRelativeTime, compareDays, resolveDay,
  methodBreakdown, dailyTransactions, toInputValue, weeklyRevenue, projectMonthRevenue, percentChange,
} from '../utils/dashboardStats';
import { calculateStoreFinancialOverview, calculateAdminCommissions } from '../utils/commissions';
import { normalizeAdminAccess } from '../utils/permissions';
import AdminCommissionModal from '../components/AdminCommissionModal';
import Dashboard from './Dashboard';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TIMEZONE = 'Asia/Jakarta';
const DONUT_RADIUS = 38;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const jakartaHour = (date) =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TIMEZONE }).format(date));

// Ikon benda langit di kartu sapaan mengikuti bagian hari.
const PERIOD_ICON = {
  'Selamat pagi': '🌅',
  'Selamat siang': '☀️',
  'Selamat sore': '🌇',
  'Selamat malam': '🌙',
};

const TrendBadge = ({ change, label = '' }) => {
  const suffix = label ? ` ${label}` : '';
  if (change === null) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Baru{suffix}</span>;
  }
  if (change === 0) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 inline-flex items-center gap-0.5">
        <Minus size={10} /> 0%{suffix}
      </span>
    );
  }
  const up = change > 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {up ? '+' : ''}{change}%{suffix}
    </span>
  );
};

// Jam berdetak sendiri; dipisah supaya tiap detik hanya komponen ini yang dirender ulang.
const LiveClock = () => {
  const [tick, setTick] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right leading-tight shrink-0">
      <div className="text-xs font-mono font-bold text-slate-200 tracking-tight">
        {tick.toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour12: false })}{' '}
        <span className="text-[9px] text-slate-400 font-sans">WIB</span>
      </div>
      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
        {tick.toLocaleDateString('id-ID', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
};

// Kartu lipat (folder) dengan header yang bisa diklik; isi tetap dirender (hanya disembunyikan).
const FolderCard = ({ open, onToggle, icon, title, meta, right, children }) => (
  <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition cursor-pointer select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-xs font-black text-slate-900 tracking-tight">{title}</h3>
          {meta}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {right}
        <span className={`w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} />
        </span>
      </div>
    </button>
    <div className={`border-t border-slate-100 bg-slate-50/40 ${open ? '' : 'hidden'}`}>{children}</div>
  </section>
);

const MetricLine = ({ left, right, rightClass = 'font-mono text-slate-600' }) => (
  <div className="flex items-center justify-between gap-1 text-slate-500">
    <span className="truncate">{left}</span>
    <span className={`shrink-0 font-medium ${rightClass}`}>{right}</span>
  </div>
);

const MetricCard = ({ label, badge, value, valueClass = 'text-slate-900', children }) => (
  <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate">{label}</span>
        {badge}
      </div>
      <div className={`text-sm font-black tracking-tight font-mono mt-0.5 truncate ${valueClass}`}>{value}</div>
    </div>
    <div className="pt-1.5 mt-1.5 border-t border-slate-100 space-y-0.5 text-[9px] min-w-0">{children}</div>
  </div>
);

const Pill = ({ className = '', children }) => (
  <span className={`text-[9px] font-bold px-1.5 py-px rounded shrink-0 ${className}`}>{children}</span>
);

const RANGE_OPTIONS = [['7', '7H'], ['14', '14H'], ['month', 'Bln']];
const METRIC_OPTIONS = [['rp', 'Rp'], ['trx', 'Trx']];

const DashboardSuperadmin = (props) => {
  const { transactions = [], customers = [], packages = [], session, companyInfo = {} } = props;
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [roleByName, setRoleByName] = useState(new Map());
  const [selectedCommissionAdmin, setSelectedCommissionAdmin] = useState(null);
  const [dayMode, setDayMode] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [showLedger, setShowLedger] = useState(false);
  const [showFinancial, setShowFinancial] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [slide, setSlide] = useState(0);
  const [rangeMode, setRangeMode] = useState('7');
  const [chartMetric, setChartMetric] = useState('rp');
  const sliderRef = useRef(null);

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
  const greeting = getGreeting(jakartaHour(now));
  const selectedDay = resolveDay(dayMode, now, customDate);
  const previousDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() - 1);
  const dayComparison = compareDays(transactions, selectedDay);
  const formatDay = (date) => date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayInputValue = toInputValue(now);
  const methods = methodBreakdown(transactions, selectedDay);
  const ledger = dailyTransactions(transactions, selectedDay);
  const displayName = session?.profile?.full_name || 'Super Administrator';
  const adminFee = companyInfo.adminFee || 10000;

  const comparison = compareMonths(transactions, now);
  const cashiers = cashierPerformance(transactions, now.getFullYear(), now.getMonth());
  const topRevenue = cashiers.length > 0 ? cashiers[0].revenue : 0;
  const payment = paymentBreakdown(customers, transactions, packages, now);

  const effectiveAccounts = allAccounts.length > 0
    ? allAccounts
    : cashiers
        .filter(c => !((c.name || '').toLowerCase().includes('cs') || roleByName.get(c.name) === 'superadmin'))
        .map(c => ({ id: c.name, full_name: c.name, role: 'admin', allowed_paths: {} }));

  // Ringkasan finansial mengikuti mode: bulan berjalan, atau bulan lalu (angka final, bukan proyeksi).
  const periodDate = compareMode ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now;
  const periodLabel = `${MONTHS[periodDate.getMonth()]} ${periodDate.getFullYear()}`;
  const periodComparison = compareMode ? compareMonths(transactions, periodDate) : comparison;
  const periodPayment = compareMode ? paymentBreakdown(customers, transactions, packages, periodDate) : payment;
  const financialOverview = calculateStoreFinancialOverview(transactions, effectiveAccounts, adminFee, periodDate);
  const arpu = periodPayment.active > 0 ? Math.round(financialOverview.grossRevenue / periodPayment.active) : 0;
  const projectedRevenue = compareMode ? financialOverview.grossRevenue : projectMonthRevenue(financialOverview.grossRevenue, now);
  const projectionChange = percentChange(projectedRevenue, periodComparison.previous.revenue);
  const marginPercent = financialOverview.grossRevenue > 0
    ? Math.round((financialOverview.netStoreProfit / financialOverview.grossRevenue) * 100)
    : 100;
  const cashierCount = effectiveAccounts.filter(a => a.role !== 'superadmin').length || 1;

  // Sisa pendapatan agar menyamai bulan lalu (bulan lalu dipakai sebagai target).
  const targetRemaining = Math.max(0, comparison.previous.revenue - comparison.current.revenue);
  const targetPercent = comparison.previous.revenue > 0
    ? Math.round((comparison.current.revenue / comparison.previous.revenue) * 100)
    : null;

  // Grafik omset: 7 hari, 14 hari, atau sejak awal bulan; nominal (Rp) atau jumlah transaksi (Trx).
  const rangeDays = rangeMode === '7' ? 7 : rangeMode === '14' ? 14 : now.getDate();
  const series = weeklyRevenue(transactions, now, rangeDays).map((day) => ({
    ...day,
    value: chartMetric === 'rp' ? day.revenue : day.count,
  }));
  const seriesMax = Math.max(...series.map((d) => d.value), 1);
  const seriesTotal = series.reduce((sum, d) => sum + d.value, 0);
  const seriesAverage = seriesTotal / rangeDays;
  const peakDay = series.reduce((best, d) => (d.value > best.value ? d : best), series[0]);
  const formatMetric = (value) => (chartMetric === 'rp' ? formatRupiahCompact(value) : `${value}`);
  const formatMetricFull = (day) => (chartMetric === 'rp' ? formatRupiah(day.revenue) : `${day.count} trx`);
  const showBarValues = rangeDays <= 7;
  const labelStep = Math.ceil(rangeDays / 7);

  const scrollSlider = (direction) => {
    const el = sliderRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  };
  const goToSlide = (index) => {
    const el = sliderRef.current;
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  };
  const handleSliderScroll = () => {
    const el = sliderRef.current;
    if (el && el.clientWidth > 0) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  const quickActions = [
    {
      id: 'pos',
      type: 'link',
      to: '/pos',
      icon: Zap,
      iconColor: 'text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
      iconBg: 'bg-blue-50',
      hoverBorder: 'hover:border-blue-500 hover:bg-blue-50/50',
      title: 'Kasir Baru',
      subLabel: 'POS Kilat',
      subColor: 'text-slate-400',
    },
    {
      id: 'customers',
      type: 'link',
      to: '/customers',
      icon: Users,
      iconColor: 'text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      iconBg: 'bg-emerald-50',
      hoverBorder: 'hover:border-emerald-500 hover:bg-emerald-50/50',
      title: 'Pelanggan',
      subLabel: `${customers.length} Terdaftar`,
      subColor: 'text-emerald-600',
    },
    {
      id: 'commission',
      type: 'button',
      onClick: () => {
        const defaultTarget = effectiveAccounts.find(a => a.role !== 'superadmin') || {
          id: 'adm-wahyu',
          full_name: 'Admin Wahyu',
          role: 'admin',
          allowed_paths: {}
        };
        setSelectedCommissionAdmin(defaultTarget);
      },
      icon: DollarSign,
      iconColor: 'text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
      iconBg: 'bg-amber-50',
      hoverBorder: 'hover:border-amber-500 hover:bg-amber-50/50',
      title: 'Kelola Komisi',
      subLabel: financialOverview.pendingCommissionBalance > 0 ? 'Pencairan' : 'Riwayat',
      subColor: 'text-amber-600',
      hasPending: financialOverview.pendingCommissionBalance > 0,
    },
    {
      id: 'rute',
      type: 'link',
      to: '/rute',
      icon: Navigation2,
      iconColor: 'text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
      iconBg: 'bg-indigo-50',
      hoverBorder: 'hover:border-indigo-500 hover:bg-indigo-50/50',
      title: 'Rute & Live',
      subLabel: 'Pelacakan',
      subColor: 'text-slate-400',
    },
    {
      id: 'wa-billing',
      type: 'link',
      to: '/customers?tab=belum_bayar',
      icon: MessageCircle,
      iconColor: 'text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      iconBg: 'bg-emerald-50',
      hoverBorder: 'hover:border-emerald-500 hover:bg-emerald-50/50',
      title: 'WA Tagihan',
      subLabel: `${payment.unpaid} Belum Bayar`,
      subColor: 'text-rose-500',
      badge: payment.unpaid > 0 ? payment.unpaid : null,
    },
    {
      id: 'settings',
      type: 'link',
      to: '/settings',
      icon: Settings,
      iconColor: 'text-slate-700 group-hover:bg-slate-800 group-hover:text-white',
      iconBg: 'bg-slate-100',
      hoverBorder: 'hover:border-slate-400 hover:bg-slate-100',
      title: 'Pengaturan',
      subLabel: 'Toko & Paket',
      subColor: 'text-slate-400',
    },
  ];

  return (
    <div className="pb-32 animate-in fade-in duration-300">
      <div className="p-4 space-y-3">

        {/* Kartu Sapaan Eksekutif */}
        <section className="relative rounded-xl border border-slate-800/60 overflow-hidden text-white bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 shadow-md">
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/30 via-transparent to-transparent" />
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
            <span className="absolute top-2 left-10 w-1 h-1 rounded-full bg-white opacity-75 animate-ping" />
            <span className="absolute top-6 left-28 w-1 h-1 rounded-full bg-indigo-200 opacity-90 animate-pulse" />
            <span className="absolute bottom-3 left-44 w-1.5 h-1.5 rounded-full bg-blue-300 opacity-40 animate-pulse" />
            <span className="absolute top-3 right-28 w-1 h-1 rounded-full bg-amber-200 opacity-75 animate-ping" />
            <span className="absolute bottom-2 right-12 w-1.5 h-1.5 rounded-full bg-white opacity-40 animate-pulse" />
          </div>
          <div className="relative z-10 p-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-slate-800/80 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-xl select-none">{PERIOD_ICON[greeting]}</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5 leading-tight">
                  <span className="text-xs font-black tracking-tight text-white">{greeting},</span>
                  <span className="font-black text-blue-400 text-xs tracking-tight truncate">{displayName} ✨</span>
                </div>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-px rounded-full text-[9px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                  👑 Superadmin
                </span>
              </div>
            </div>
            <LiveClock />
          </div>
        </section>

        {/* Finansial Eksekutif (lipat, berisi slider kartu) */}
        <FolderCard
          open={showFinancial}
          onToggle={() => setShowFinancial((v) => !v)}
          icon={(
            <span className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              <ChartColumn size={16} />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-1 ring-white">
                <TrendingUp size={8} />
              </span>
            </span>
          )}
          title="Finansial Eksekutif"
          meta={<span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1 rounded">{periodLabel}</span>}
        >
          <div className="pb-2 px-2">
            <div className="flex items-center gap-1 px-1 pt-2 pb-1.5 border-b border-slate-200/60 text-[10px]">
              <span className="font-semibold text-slate-500">Mode:</span>
              {[[false, 'Bulan Ini'], [true, 'Bulan Lalu']].map(([mode, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCompareMode(mode)}
                  className={`px-1.5 py-px rounded font-bold border transition active:scale-95 cursor-pointer ${
                    compareMode === mode
                      ? 'bg-white text-blue-700 border-blue-200 shadow-2xs'
                      : 'text-slate-600 border-transparent hover:bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              ref={sliderRef}
              onScroll={handleSliderScroll}
              className="flex overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory w-full pt-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {/* Slide 1: Omset & ARPU */}
              <div className="w-full shrink-0 grid grid-cols-2 gap-2 snap-start">
                <MetricCard label="Omset Kotor" badge={<TrendBadge change={periodComparison.revenueChange} />} value={formatRupiah(financialOverview.grossRevenue)}>
                  <MetricLine left={`${periodComparison.current.count} trx lunas`} right={`bulan lalu ${formatRupiahCompact(periodComparison.previous.revenue)}`} />
                  <MetricLine left="Total kotor toko" right={`${periodPayment.active} plg aktif`} rightClass="text-indigo-600" />
                </MetricCard>
                <MetricCard label="ARPU" badge={<Pill className="text-blue-700 bg-blue-50">per pelanggan</Pill>} value={formatRupiah(arpu)} valueClass="text-blue-700">
                  <MetricLine left="Pelanggan aktif" right={`${periodPayment.active} plg`} />
                  <MetricLine left="Omset / pelanggan" right={formatRupiahCompact(arpu)} />
                </MetricCard>
              </div>

              {/* Slide 2: Komisi & Laba */}
              <div className="w-full shrink-0 grid grid-cols-2 gap-2 snap-start">
                <MetricCard label="Hak Komisi" badge={<Pill className="text-amber-700 bg-amber-50 border border-amber-200/60">{cashierCount} Kasir</Pill>} value={formatRupiah(financialOverview.totalCommissionLiability)} valueClass="text-amber-600">
                  <MetricLine left="Tarif POS" right={`${formatRupiahCompact(adminFee)}/trx`} />
                  <MetricLine left="Sudah cair" right={formatRupiah(financialOverview.totalCommissionPaid)} />
                  <MetricLine
                    left="Pending"
                    right={formatRupiah(financialOverview.pendingCommissionBalance)}
                    rightClass={financialOverview.pendingCommissionBalance > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}
                  />
                </MetricCard>
                <MetricCard label="Laba Bersih" badge={<Pill className="text-blue-700 bg-blue-50">{marginPercent}%</Pill>} value={formatRupiah(financialOverview.netStoreProfit)}>
                  <MetricLine left="Net profit" right="Setelah komisi" rightClass="font-bold text-emerald-600" />
                  <MetricLine left="Margin toko" right={`${marginPercent}%`} />
                </MetricCard>
              </div>

              {/* Slide 3: Kolektibilitas & Proyeksi */}
              <div className="w-full shrink-0 grid grid-cols-2 gap-2 snap-start">
                <MetricCard label="Kolektibilitas" badge={<Pill className="text-emerald-600 bg-emerald-50">{periodPayment.paidPercent}%</Pill>} value={`${periodPayment.paid} / ${periodPayment.active} Plg`}>
                  <MetricLine left="Tertunda" right={`${periodPayment.unpaid} Plg`} rightClass="font-mono text-amber-600" />
                  <MetricLine left="Nominal" right={formatRupiahCompact(periodPayment.unpaidAmount) === '0' ? 'Rp 0' : `Rp ${formatRupiahCompact(periodPayment.unpaidAmount)}`} rightClass="font-bold text-slate-700" />
                </MetricCard>
                <MetricCard
                  label={compareMode ? 'Total Bulan' : 'Proyeksi Kas'}
                  badge={<Pill className="text-blue-700 bg-blue-50">{compareMode ? 'Final' : 'Run-Rate'}</Pill>}
                  value={formatRupiah(projectedRevenue)}
                  valueClass="text-blue-700"
                >
                  <MetricLine left="Tren bulanan" right={projectionChange === null ? 'Baru' : `${projectionChange > 0 ? '+' : ''}${projectionChange}% MoM`} rightClass={`font-bold ${projectionChange !== null && projectionChange < 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                  <MetricLine left="Bulan sebelumnya" right={formatRupiahCompact(periodComparison.previous.revenue) === '0' ? 'Rp 0' : `Rp ${formatRupiahCompact(periodComparison.previous.revenue)}`} />
                </MetricCard>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 pt-1 text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Geser kiri" onClick={() => scrollSlider(-1)} className="w-5 h-5 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer">
                  <ChevronLeft size={12} />
                </button>
                <button type="button" aria-label="Geser kanan" onClick={() => scrollSlider(1)} className="w-5 h-5 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer">
                  <ChevronRight size={12} />
                </button>
                <span className="font-medium text-slate-400 select-none">Sentuh &amp; geser kartu</span>
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Slide ${index + 1}`}
                    onClick={() => goToSlide(index)}
                    className={`rounded-full transition hover:scale-110 cursor-pointer ${slide === index ? 'w-1.5 h-1.5 bg-blue-600' : 'w-1 h-1 bg-slate-300 hover:bg-slate-400'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </FolderCard>

        {/* Aksi Cepat (lipat) */}
        <FolderCard
          open={showQuickActions}
          onToggle={() => setShowQuickActions((v) => !v)}
          icon={(
            <span className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0">
              <FolderKanban size={14} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-1 ring-white">
                <Zap size={7} />
              </span>
            </span>
          )}
          title="Aksi Cepat"
          meta={<span className="text-[10px] text-slate-400 font-medium">• {quickActions.length} Menu</span>}
          right={<span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-px rounded border border-amber-200/70">{showQuickActions ? 'Tutup' : 'Buka'}</span>}
        >
          <div className="px-2.5 pb-2.5 pt-2">
            <div className="grid grid-cols-3 gap-1.5">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                const tileClass = `group flex flex-col items-center p-2 rounded-lg bg-white border border-slate-200/80 transition active:scale-95 text-center cursor-pointer ${action.hoverBorder}`;
                const inner = (
                  <>
                    <span className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition duration-200 ${action.iconBg} ${action.iconColor}`}>
                      <IconComponent size={16} />
                      {action.hasPending && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 border-2 border-white rounded-full animate-ping" />
                      )}
                      {action.badge && (
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black rounded-full h-3.5 min-w-[14px] px-0.5 flex items-center justify-center ring-1 ring-white leading-none">
                          {action.badge}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 mt-1 leading-tight">{action.title}</span>
                    <span className={`text-[9px] font-bold leading-none mt-0.5 ${action.subColor}`}>{action.subLabel}</span>
                  </>
                );

                return action.type === 'button' ? (
                  <button key={action.id} type="button" onClick={action.onClick} className={tileClass}>{inner}</button>
                ) : (
                  <Link key={action.id} to={action.to} className={tileClass}>{inner}</Link>
                );
              })}
            </div>
          </div>
        </FolderCard>

        {/* Pendapatan Harian */}
        <section className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-700">
              <CalendarDays size={14} className="text-blue-600" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider">Pendapatan Harian</h4>
            </div>
            <TrendBadge change={dayComparison.revenueChange} label="Kemarin" />
          </div>
          <p className="text-xs font-semibold text-slate-800">{formatDay(selectedDay)}</p>

          <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-0.5 rounded-lg text-[11px] font-semibold text-slate-500 text-center">
            {[['today', 'Hari Ini'], ['yesterday', 'Kemarin'], ['custom', 'Pilih Tanggal']].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDayMode(mode)}
                className={`py-1 rounded-md transition active:scale-95 cursor-pointer ${
                  dayMode === mode ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-slate-800'
                }`}
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
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
            />
          )}

          <div className="bg-[#0f172a] rounded-lg p-2.5 text-white shadow-xs">
            <div className="flex items-center justify-between text-[10px] text-slate-300">
              <span>Total Uang Masuk</span>
              <span className="text-[9px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1 py-px rounded">
                {dayComparison.current.count} Transaksi
              </span>
            </div>
            <p className="text-lg font-black tracking-tight mt-0.5 text-white font-mono">{formatRupiah(dayComparison.current.revenue)}</p>
            <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Hari Sebelumnya ({previousDay.getDate()} {MONTHS[previousDay.getMonth()].slice(0, 3)}):</span>
              <span className="font-bold text-slate-200 font-mono">{formatRupiah(dayComparison.previous.revenue)}</span>
            </div>
          </div>

          {/* Uang masuk per metode */}
          {methods.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uang masuk per metode</p>
              {methods.map((entry) => {
                const percent = dayComparison.current.revenue > 0
                  ? Math.round((entry.revenue / dayComparison.current.revenue) * 100)
                  : 0;
                return (
                  <div key={entry.method} className="p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <CreditCard size={12} className="text-indigo-600" />
                        {entry.method} <span className="text-slate-400 text-[10px]">· {entry.count} trx</span>
                      </span>
                      <span className="font-bold text-slate-900">{formatRupiah(entry.revenue)}</span>
                    </div>
                    <div className="h-1 bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowLedger(!showLedger)}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-blue-50/50 border border-blue-100/70 rounded-md text-[11px] font-semibold text-blue-700 active:scale-95 transition select-none hover:bg-blue-100/60 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen size={12} className="text-blue-600" /> Buku kas harian ({ledger.length} transaksi)
            </span>
            <ChevronDown size={12} className={`text-blue-500 transition-transform duration-200 ${showLedger ? 'rotate-180' : ''}`} />
          </button>

          {showLedger && (
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {ledger.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3 bg-slate-50 rounded-lg">
                  Belum ada uang masuk pada hari ini.
                </p>
              ) : (
                ledger.map((trx) => (
                  <div key={trx.id} className="flex items-center justify-between gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {(trx.customerName || trx.instansiName || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{trx.customerName || trx.instansiName || 'Tanpa nama'}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {trx.cashier_name || 'Kasir tidak diketahui'} · {trx.payment_method || 'Tidak dicatat'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shrink-0">
                      {formatRupiah(trx.price)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Omset 7 hari / 14 hari / bulan ini */}
        <section className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-700">
              <ChartColumn size={13} className="text-blue-600" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider">
                Omset {rangeMode === 'month' ? 'Bulan Ini' : `${rangeMode} Hari Terakhir`}
              </h4>
            </div>
            <div className="flex items-center gap-1">
              {[[RANGE_OPTIONS, rangeMode, setRangeMode, 'Rentang'], [METRIC_OPTIONS, chartMetric, setChartMetric, 'Metrik']].map(([options, current, setter, groupLabel]) => (
                <div key={groupLabel} role="group" aria-label={groupLabel} className="flex items-center bg-slate-100 rounded-md p-0.5 text-[10px] font-bold text-slate-500">
                  {options.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setter(value)}
                      className={`px-1.5 py-px rounded transition cursor-pointer ${current === value ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'hover:text-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-50/70 border border-slate-100 rounded-md p-1.5 text-center">
            <div className="p-0.5">
              <span className="text-[9px] font-semibold text-slate-400 block uppercase">Rata-rata</span>
              <span className="text-[11px] font-black text-slate-800 font-mono">
                {formatMetric(Math.round(seriesAverage))}<span className="text-[9px] font-normal text-slate-500">/hr</span>
              </span>
            </div>
            <div className="p-0.5 border-x border-slate-200/60">
              <span className="text-[9px] font-semibold text-blue-600 block uppercase">Tertinggi</span>
              <span className="text-[11px] font-black text-blue-600 font-mono">
                {formatMetric(peakDay.value)} <span className="text-[9px] text-slate-400 font-medium">({peakDay.date.getDate()}/{peakDay.date.getMonth() + 1})</span>
              </span>
            </div>
            <div className="p-0.5">
              <span className="text-[9px] font-semibold text-slate-400 block uppercase">Total {rangeMode === 'month' ? 'Bulan' : `${rangeMode} Hari`}</span>
              <span className="text-[11px] font-black text-slate-900 font-mono">{formatMetric(seriesTotal)}</span>
            </div>
          </div>

          <div className="relative pt-4">
            <div className="relative h-20 flex items-end gap-0.5 sm:gap-1 px-0.5">
              {seriesMax > 0 && seriesAverage > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-slate-300 pointer-events-none flex justify-end"
                  style={{ bottom: `${Math.min(100, (seriesAverage / seriesMax) * 100)}%` }}
                >
                  <span className="text-[8px] font-bold text-slate-400 bg-white px-1 -mt-2 leading-none font-mono">Rerata: {formatMetric(Math.round(seriesAverage))}</span>
                </div>
              )}
              {series.map((day) => {
                const isToday = day.date.toDateString() === now.toDateString();
                const isPeak = day === peakDay && day.value > 0;
                const heightPercent = day.value > 0 ? Math.max(8, Math.round((day.value / seriesMax) * 100)) : 0;
                return (
                  <div
                    key={day.date.toISOString()}
                    className="flex-1 min-w-0 h-full flex items-end justify-center relative group"
                    title={`${day.date.getDate()}/${day.date.getMonth() + 1}: ${formatMetricFull(day)} · ${day.count} trx`}
                  >
                    {showBarValues && day.value > 0 && (
                      <span
                        className={`absolute left-1/2 -translate-x-1/2 text-[8px] font-bold font-mono whitespace-nowrap ${isPeak ? 'text-blue-700' : 'text-slate-600'}`}
                        style={{ bottom: `calc(${heightPercent}% + 2px)` }}
                      >
                        {formatMetric(day.value)}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t transition-colors ${
                        day.value === 0
                          ? 'h-1 bg-slate-100 group-hover:bg-slate-200'
                          : isToday
                            ? 'bg-blue-600'
                            : isPeak
                              ? 'bg-gradient-to-t from-blue-600 to-blue-400'
                              : 'bg-blue-200 group-hover:bg-blue-300'
                      }`}
                      style={day.value > 0 ? { height: `${heightPercent}%` } : undefined}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-0.5 sm:gap-1 px-0.5 mt-1">
              {series.map((day, index) => {
                const isToday = day.date.toDateString() === now.toDateString();
                const showLabel = isToday || index % labelStep === 0;
                return (
                  <div key={day.date.toISOString()} className="flex-1 min-w-0 flex justify-center">
                    {showLabel && (
                      <span className={`text-[9px] leading-none whitespace-nowrap ${isToday ? 'font-extrabold bg-blue-600 text-white px-1 py-0.5 rounded' : 'font-medium text-slate-400'}`}>
                        {day.date.getDate()}/{day.date.getMonth() + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {peakDay.value > 0 && (
            <div className="flex items-center justify-between text-[10px] bg-blue-50/40 rounded-md p-1.5 border border-blue-100/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                <span className="font-bold text-slate-800 truncate">
                  {peakDay.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}:
                </span>
                <span className="font-mono font-black text-blue-700">{formatMetricFull(peakDay)}</span>
              </div>
              <span className="text-[9px] font-bold text-blue-700 bg-blue-100/80 px-1 rounded shrink-0">Puncak</span>
            </div>
          )}
        </section>

        {/* Target vs bulan lalu & Penagihan */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate flex items-center gap-1">
                  <Target size={11} className="text-blue-600 shrink-0" /> Target Sisa
                </span>
                {targetPercent !== null && (
                  <span className={`text-[9px] font-extrabold border px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 ${targetPercent >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                    {targetPercent >= 100 && <Check size={10} />} {targetPercent}%
                  </span>
                )}
              </div>
              <p className="text-base font-black font-mono text-slate-900 tracking-tight mt-1 truncate">{formatRupiah(targetRemaining)}</p>
            </div>
            <div className="pt-1.5 mt-1.5 border-t border-slate-100 text-[9px] text-slate-500 space-y-0.5">
              {comparison.previous.revenue > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">Target = {previousMonthLabel}</span>
                    <span className="font-mono font-bold text-slate-700 shrink-0">{formatRupiahCompact(comparison.previous.revenue)}</span>
                  </div>
                  {comparison.current.revenue > comparison.previous.revenue && (
                    <p className="font-semibold text-emerald-600 font-mono truncate">Surplus +{formatRupiahCompact(comparison.current.revenue - comparison.previous.revenue)}</p>
                  )}
                </>
              ) : (
                <p className="truncate">Belum ada data bulan lalu</p>
              )}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Penagihan</span>
                <span className="text-[9px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shrink-0">{payment.paidPercent}%</span>
              </div>
              <div className="flex items-baseline justify-between mt-1 leading-none">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-base font-black text-slate-900 font-mono">{payment.paid}</span>
                  <span className="text-[10px] font-medium text-slate-400 font-mono">/ {payment.active} plg</span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">
                  Avg {formatRupiahCompact(comparison.current.count > 0 ? Math.round(comparison.current.revenue / comparison.current.count) : 0)}
                </span>
              </div>
            </div>
            <div className="pt-1.5 mt-1.5 border-t border-slate-100 space-y-1">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${payment.paidPercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">{payment.paid} Lunas</span>
                <span className="text-amber-700 font-bold bg-amber-50 px-1 rounded">{payment.unpaid} Tertunda</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Pembayaran Bulan Ini */}
        <section className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Status Pembayaran Bulan Ini</h4>
            </div>
            <span className="text-[9px] font-medium text-slate-400 font-mono">{payment.active} Pelanggan • {monthLabel}</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex-1 space-y-1.5 min-w-0">
              <Link
                to="/customers?tab=sudah_bayar"
                className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100/80 hover:bg-emerald-50 transition active:scale-95"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-700 font-bold block leading-none">Sudah Bayar</span>
                    <span className="text-[9px] text-slate-400 mt-0.5 block">{payment.paid} Plg</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-black text-emerald-700 font-mono block leading-none">{payment.paidPercent}%</span>
                  <span className="text-[9px] font-mono text-emerald-600 font-semibold">{formatRupiahCompact(payment.paidAmount) === '0' ? 'Rp 0' : `Rp ${formatRupiahCompact(payment.paidAmount)}`}</span>
                </div>
              </Link>
              <Link
                to="/customers?tab=belum_bayar"
                className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50/70 border border-amber-100/80 hover:bg-amber-50 transition active:scale-95"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-700 font-bold block leading-none">Belum Bayar</span>
                    <span className="text-[9px] text-slate-400 mt-0.5 block">{payment.unpaid} Plg</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-black text-amber-700 font-mono block leading-none">{payment.active > 0 ? 100 - payment.paidPercent : 0}%</span>
                  <span className="text-[9px] font-mono text-amber-600 font-semibold">{formatRupiahCompact(payment.unpaidAmount) === '0' ? 'Rp 0' : `Rp ${formatRupiahCompact(payment.unpaidAmount)}`}</span>
                </div>
              </Link>
            </div>

            <div className="relative w-20 h-20 shrink-0 flex items-center justify-center select-none">
              <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90" role="img" aria-label={`${payment.paidPercent}% pelanggan sudah bayar`}>
                <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" stroke={payment.active > 0 ? '#f59e0b' : '#f1f5f9'} strokeWidth="11" />
                <circle
                  cx="50" cy="50" r={DONUT_RADIUS} fill="none" stroke="#10b981" strokeWidth="11"
                  strokeDasharray={`${(payment.paidPercent / 100) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none leading-none">
                <span className="text-xs font-black text-slate-900 font-mono tracking-tight">{payment.paidPercent}%</span>
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tight mt-0.5">{payment.paid}/{payment.active} Lunas</span>
              </div>
            </div>
          </div>
        </section>

        {/* Performa Kasir & Hak Komisi */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy size={13} className="text-amber-500" /> Performa Kasir &amp; Hak Komisi · {MONTHS[now.getMonth()]}
            </h2>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              Fee Kasir: {formatRupiah(companyInfo.adminFee || 10000)}/trx
            </span>
          </div>

          <div className="space-y-2.5">
            {cashiers.length === 0 ? (
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 text-center text-xs text-slate-400 italic">
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
                  ? 'bg-amber-400 text-amber-950 ring-1 ring-amber-300'
                  : index === 1
                  ? 'bg-slate-300 text-slate-800'
                  : index === 2
                  ? 'bg-orange-300 text-orange-950'
                  : 'bg-slate-100 text-slate-600';

                return (
                  <div
                    key={cashier.name}
                    className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2.5 relative overflow-hidden transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${medalColor}`}>
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                            {cashier.name}
                            {isSuper && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                👑 Super Admin (Non-Komisi)
                              </span>
                            )}
                            {!isSuper && isCS && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                💬 Layanan CS (Non-Komisi)
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {cashier.count} transaksi lunas bulan ini
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{formatRupiah(cashier.revenue)}</p>
                        <span className="text-[10px] text-slate-400">Total Omset</span>
                      </div>
                    </div>

                    {/* Revenue Bar */}
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                        style={{ width: `${topRevenue > 0 ? Math.max(4, Math.round((cashier.revenue / topRevenue) * 100)) : 0}%` }}
                      />
                    </div>

                    {/* Dedicated Commission Status Capsule */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {isSuper ? (
                        <div className="w-full flex items-center justify-between bg-purple-50/70 p-2 rounded-lg border border-purple-100/80">
                          <span className="text-[11px] font-semibold text-purple-900">Aturan Akun:</span>
                          <span className="text-[11px] text-purple-700 italic font-medium">Rp 0 (Super Admin)</span>
                        </div>
                      ) : isCS ? (
                        <div className="w-full flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[11px] font-semibold text-slate-800">Kanal Layanan:</span>
                          <span className="text-[11px] text-slate-600 italic font-medium">Rp 0 (Kanal CS)</span>
                        </div>
                      ) : (
                        <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200/60">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div>
                              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider block">Hak Komisi (total)</span>
                              <span className="font-bold text-emerald-600 text-xs">{formatRupiah(comm.totalEarned)}</span>
                            </div>
                            <div className="h-5 w-px bg-slate-200" />
                            <div>
                              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider block">Sudah Cair</span>
                              <span className="font-semibold text-slate-700 text-xs">{formatRupiah(comm.totalPaid)}</span>
                            </div>
                            <div className="h-5 w-px bg-slate-200" />
                            <div>
                              <span className="text-[9px] font-medium text-amber-600 uppercase tracking-wider block">Sisa Pending</span>
                              <span className="font-bold text-amber-600 text-xs">{formatRupiah(comm.pendingBalance)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCommissionAdmin(matchedAdmin)}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
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

        {/* Aktivitas login admin */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-600" /> Aktivitas Login Terbaru
            </h2>
            <span className="text-[10px] font-semibold text-slate-400">Security Audit</span>
          </div>

          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            {accountsLoading ? (
              <p className="text-xs text-slate-400 italic text-center py-2.5">Memuat aktivitas...</p>
            ) : accounts.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-2.5">Belum ada data login.</p>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between gap-2.5 p-2 sm:p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/60 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                      acc.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {(acc.full_name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1.5">
                        {acc.full_name}
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          acc.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {acc.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </p>
                      {acc.last_login_at ? (
                        <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="flex items-center gap-1">
                            <Smartphone size={10} className="shrink-0 text-slate-400" /> {acc.last_login_device || 'Device tidak diketahui'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={10} className="shrink-0 text-slate-400" /> {acc.last_login_location || 'Lokasi tidak diketahui'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">Belum pernah login</p>
                      )}
                    </div>
                  </div>
                  {acc.last_login_at && (
                    <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200/60 px-2 py-0.5 rounded-md shrink-0 shadow-xs">
                      {formatRelativeTime(acc.last_login_at, now)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detail Lengkap</span>
          <div className="flex-1 h-px bg-slate-200" />
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
