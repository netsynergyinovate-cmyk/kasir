import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Wallet, CalendarDays, BookOpen, ChevronDown, Receipt, CheckCircle, AlertCircle, Trophy, Clock, Smartphone, MapPin, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatRupiah, formatRupiahCompact } from '../utils/format';
import { getGreeting, compareMonths, cashierPerformance, paymentSummary, formatRelativeTime, compareDays, resolveDay, methodBreakdown, dailyTransactions, toInputValue, weeklyRevenue } from '../utils/dashboardStats';
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
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [roleByName, setRoleByName] = useState(new Map());
  const [dayMode, setDayMode] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('admin_profiles')
      .select('id, full_name, email, role, last_login_at, last_login_device, last_login_location')
      .order('last_login_at', { ascending: false, nullsFirst: false })
      .limit(6)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setAccounts(data);
        setAccountsLoading(false);
      });

    // Daftar lengkap (tidak dibatasi 6) hanya untuk mencocokkan nama kasir -> role, dipakai
    // membedakan "Jasa Admin" (komisi) dari transaksi milik superadmin di daftar Performa Kasir.
    supabase
      .from('admin_profiles')
      .select('full_name, role')
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setRoleByName(new Map(data.map((p) => [p.full_name, p.role])));
      });
    return () => { cancelled = true; };
  }, []);

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
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-1.5">
            <Trophy size={12} /> Performa Kasir · {MONTHS[now.getMonth()]}
          </h2>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            {cashiers.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">Belum ada transaksi bulan ini.</p>
            ) : (
              cashiers.map((cashier, index) => {
                const role = roleByName.get(cashier.name);
                const commission = cashier.count * (companyInfo.adminFee || 10000);
                return (
                  <div key={cashier.name}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        <span className="text-gray-400 mr-1.5">#{index + 1}</span>{cashier.name}
                        {role === 'superadmin' && <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Super Admin</span>}
                      </p>
                      <p className="text-xs font-black text-gray-900 shrink-0">{formatRupiah(cashier.revenue)}</p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${topRevenue > 0 ? Math.max(4, Math.round((cashier.revenue / topRevenue) * 100)) : 0}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                      <span>{cashier.count} transaksi</span>
                      {role === 'superadmin' ? (
                        <span className="text-gray-400 italic">Tidak dapat komisi</span>
                      ) : (
                        <span className="font-bold text-emerald-600">Komisi: {formatRupiah(commission)}</span>
                      )}
                    </p>
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
    </div>
  );
};

export default DashboardSuperadmin;
