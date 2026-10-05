import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Building2, ChevronLeft, ChevronRight, CheckCircle, Calendar, ChevronDown, MessageCircle, Send, CheckCircle2, DollarSign, History, X, Info } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import PaymentStatusDonut from '../components/PaymentStatusDonut';
import RevenueBarChart from '../components/RevenueBarChart';
import RouteOverview from '../components/RouteOverview';
import { getGreeting, kasbonSummary } from '../utils/dashboardStats';
import { calculateAdminCommissions, commissionByMonth, commissionRuleNotes, monthKey, monthLabel, payoutPeriodKey, bonusPeriodKey } from '../utils/commissions';
import { normalizeAdminAccess } from '../utils/permissions';
import { useWhatsAppReminders } from '../hooks/useWhatsAppReminders';
import './Dashboard.css';

// embedded: true saat komponen ini ditempel di bawah DashboardSuperadmin.jsx (lihat DashboardSuperadmin.jsx) —
// menyembunyikan bagian yang superadmin SUDAH punya versi barunya sendiri di atas (Aksi Cepat, Pengingat
// Tagihan, Status Pembayaran), supaya tidak dobel. Dashboard admin biasa (route "/") tidak terpengaruh,
// tetap tampil lengkap seperti biasa.
const Dashboard = ({ hideHeader = false, embedded = false, visits = [], onAddVisit, canManageRoute = false, origin = null, myPosition = null, locationStatus = 'off', adminLocations = [], onRetryLocation, transactions = [], customers = [], packages = [], companyInfo = {}, session, setReceiptToView, setInstansiReceiptToView }) => {
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [activePaymentTab, setActivePaymentTab] = useState(() => {
    return localStorage.getItem('kasir_dashboard_pay_tab') || 'unpaid';
  });

  useEffect(() => {
    try { localStorage.setItem('kasir_dashboard_pay_tab', activePaymentTab); } catch { /* diabaikan: best-effort */ }
  }, [activePaymentTab]);
  const [unpaidExpanded, setUnpaidExpanded] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
  const [reminderExpanded, setReminderExpanded] = useState(false);
  const {
    sendingReminderId, isSendingBatch, reminderFeedback, setReminderFeedback,
    sendSingleReminder, sendBatchReminders,
  } = useWhatsAppReminders({ companyInfo, session });

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Filter for metrics and list (month and year)
  const transactionsThisMonth = transactions.filter(trx => {
    const trxDate = new Date(trx.date);
    return trxDate.getMonth() === selectedMonth && trxDate.getFullYear() === selectedYear;
  });

  // Filter for metrics and list (with day filter)
  const filteredTransactions = transactionsThisMonth.filter(trx => {
    const trxDate = new Date(trx.date);
    return selectedDay === 'all' || trxDate.getDate() === Number(selectedDay);
  });

  // 1. Total Potential Target (All active customers' package prices)
  const totalPotentialTarget = customers.reduce((acc, cust) => {
    const pkg = packages.find(p => p.name === cust.package);
    return acc + (pkg ? Number(pkg.price) : 0);
  }, 0);

  // 2. Gross Revenue (Total successful transactions in selected period)
  const grossRevenue = filteredTransactions.reduce((acc, curr) => acc + curr.price, 0);

  // 3. Remaining Target
  const remainingTarget = totalPotentialTarget - grossRevenue;
  const remainingTargetPercent = totalPotentialTarget > 0
    ? Math.max(0, Math.min(100, Math.round((remainingTarget / totalPotentialTarget) * 100)))
    : 0;
  // Transaksi retail yang benar-benar lunas di periode ini (dasar nominal Total Kotor)
  const lunasTrxCount = filteredTransactions.filter((t) => t.status === 'LUNAS' || t.type === 'instansi').length;

  // Piutang KASBON periode ini (kekurangan bayar yang belum ditutup pelanggan) — sama periodenya
  // dengan "Total Kotor" di atas.
  const kasbon = kasbonSummary(filteredTransactions);

  // 4. Komisi Jasa Kasir dihitung PER BULAN (bulan yang dipilih di dashboard). Seluruh aturan (superadmin & CS
  // tidak berkomisi, atribusi toko, dll.) ada di calculateAdminCommissions. Tarif per transaksi ditetapkan
  // Superadmin (company_settings.admin_fee) dan pencairan dicatat Superadmin untuk bulan yang dibayar.
  const commissionFee = companyInfo.adminFee || 10000;
  const userAccess = normalizeAdminAccess(session?.profile?.allowed_paths);
  const myRole = session?.profile?.role;
  const commissionPeriod = monthKey(new Date(selectedYear, selectedMonth, 1));
  const commissionMonthLabel = monthLabel(commissionPeriod);
  const myCommissionData = calculateAdminCommissions(
    transactions,
    session?.user?.id,
    session?.profile?.full_name,
    commissionFee,
    userAccess.commissions || [],
    myRole,
    commissionPeriod,
    userAccess.bonuses || []
  );
  const commissionMonths = commissionByMonth(
    transactions,
    session?.user?.id,
    session?.profile?.full_name,
    commissionFee,
    myRole,
    userAccess.commissions || [],
    userAccess.bonuses || []
  );
  const commissionNotes = commissionRuleNotes(myCommissionData);
  // Sisa komisi yang belum cair pada bulan-bulan selain bulan yang sedang dilihat
  const otherMonthsPending = commissionMonths
    .filter((month) => month.key !== commissionPeriod)
    .reduce((sum, month) => sum + month.pending, 0);
  const [showCommissionHistoryModal, setShowCommissionHistoryModal] = useState(false);

  // Payment status breakdown (active customers only, for the selected month/year)
  const activeCustomers = customers.filter(c => c.status === 'aktif');

  const isPaidThisPeriod = (customer) => transactionsThisMonth.some(trx =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase()
  );

  const paidCustomers = activeCustomers.filter(isPaidThisPeriod);
  const unpaidCustomers = activeCustomers.filter(c => !isPaidThisPeriod(c));
  const totalActiveCustomers = activeCustomers.length;
  // Progres Penagihan = pelanggan AKTIF yang sudah bayar bulan ini, bukan jumlah transaksi vs
  // SELURUH pelanggan (termasuk isolir) seperti versi lama — biar sejalan dengan kartu "Sisa Client".
  const activePaidPercent = totalActiveCustomers > 0
    ? Math.round((paidCustomers.length / totalActiveCustomers) * 100)
    : 0;

  // Due-date reminders: always based on the real current date, independent of the period filter above.
  const today = new Date();
  const isPaidThisRealMonth = (customer) => transactions.some(trx =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase() &&
    new Date(trx.date).getMonth() === today.getMonth() &&
    new Date(trx.date).getFullYear() === today.getFullYear()
  );

  const reminderList = activeCustomers
    .filter(c => c.due_date !== null && c.due_date !== undefined && !isPaidThisRealMonth(c))
    .map(c => ({ ...c, dueDiff: today.getDate() - Number(c.due_date) }))
    .filter(c => c.dueDiff >= -3)
    .sort((a, b) => b.dueDiff - a.dueDiff);

  const getReminderBadge = (diff) => {
    if (diff > 0) return { text: `Terlambat ${diff} hari`, className: 'bg-red-100 text-red-700' };
    if (diff === 0) return { text: 'Jatuh tempo hari ini', className: 'bg-orange-100 text-orange-700' };
    return { text: `H-${Math.abs(diff)}`, className: 'bg-amber-100 text-amber-700' };
  };

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

  // Revenue trend: 6 months ending at the selected month/year (gross revenue, same definition as "Total Kotor")
  const revenueChartData = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const monthDate = new Date(selectedYear, selectedMonth - offset, 1);
    const monthIndex = monthDate.getMonth();
    const yearForMonth = monthDate.getFullYear();

    const monthRevenue = transactions
      .filter(trx => {
        const trxDate = new Date(trx.date);
        return trxDate.getMonth() === monthIndex && trxDate.getFullYear() === yearForMonth;
      })
      .reduce((acc, curr) => acc + curr.price, 0);

    return { label: months[monthIndex].slice(0, 3), value: monthRevenue };
  });

  return (
    <div className="dashboard-container p-4 space-y-4 pb-32 animate-in fade-in duration-300">

      {/* Greeting Section (disembunyikan saat dipakai di bawah Dashboard Superadmin) */}
      {!hideHeader && (
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-blue-600">
            {getGreeting(new Date().getHours())} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <h2 className="text-[20px] font-bold text-gray-900 leading-snug">
              Halo, <span className="text-blue-600">{companyInfo.adminName || 'Admin'}</span>
            </h2>
            <span className="text-[22px] animate-wave-hand select-none" title="Halo!">👋</span>
          </div>
        </div>
      )}

      {/* Periode, Metrics Grid, dan banner "Barusan" — disembunyikan saat embedded: superadmin punya
          filter periode & kartu finansialnya sendiri di section-section baru (Finansial Eksekutif,
          Target/Penagihan, Pendapatan Harian + Omset 7/14/Bulan, Aktivitas Transaksi Terbaru). */}
      {!embedded && (
      <>
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-100 rounded-xl shadow-xs">
        <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] shrink-0">
          <Calendar size={13} />
          <span className="tracking-wide uppercase">Periode</span>
        </div>
        <div className="flex gap-1.5">
          <div className="relative group">
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-gray-50 border border-gray-200/80 rounded-lg outline-none text-[10px] font-semibold text-gray-700 pl-2 pr-6 py-1 appearance-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="all">Semua Hari</option>
              {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          </div>
          <div className="relative group">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-gray-50 border border-gray-200/80 rounded-lg outline-none text-[10px] font-semibold text-gray-700 pl-2 pr-6 py-1 appearance-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              {months.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          </div>
          <div className="relative group">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-gray-50 border border-gray-200/80 rounded-lg outline-none text-[10px] font-semibold text-gray-700 pl-2 pr-6 py-1 appearance-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Target Sisa Card */}
        <div className="bg-[#5b3cf5] py-2.5 px-3 super-rounded text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[8px] font-bold text-indigo-100 uppercase tracking-widest">Target Sisa</p>
            <span className="text-[7px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full shrink-0">Ekskl. CS</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <p className="text-sm font-extrabold leading-none truncate">{formatRupiah(remainingTarget > 0 ? remainingTarget : 0)}</p>
            <span className="text-emerald-200 text-[8px] font-bold shrink-0">{remainingTargetPercent}% sisa</span>
          </div>
          <p className="text-[8px] text-indigo-100/80 font-medium mt-0.5">Target: {formatRupiah(totalPotentialTarget)}</p>
        </div>

        {/* Jasa Admin / Komisi Card */}
        <div className="bg-[#0ea569] py-2 px-2.5 super-rounded text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[8px] font-bold text-emerald-100 uppercase tracking-widest">Jasa & Komisi</p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowCommissionHistoryModal(true)}
                className="text-[7px] font-bold bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors"
              >
                <Info size={8} /> Cara hitung
              </button>
              {myCommissionData.history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCommissionHistoryModal(true)}
                  className="text-[7px] font-bold bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors"
                >
                  <History size={8} /> Riwayat ({myCommissionData.history.length})
                </button>
              )}
            </div>
          </div>
          <p className="text-[7px] text-emerald-100/90 mt-0.5">Hak komisi {commissionMonthLabel}</p>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <p className="text-sm font-extrabold leading-none truncate">{formatRupiah(myCommissionData.totalEarned)}</p>
            <span className="text-[7px] text-emerald-100 font-medium shrink-0">
              {myCommissionData.earnedTrxCount} transaksi × {formatRupiah(myCommissionData.feePerTransaction)}
              {myCommissionData.bonusTotal > 0 && ` = ${formatRupiah(myCommissionData.autoEarned)}`}
            </span>
          </div>
          {myCommissionData.bonusTotal > 0 && (
            <p className="text-[7px] text-amber-200 font-bold mt-0.5 truncate">+ Tambahan dari Superadmin {formatRupiah(myCommissionData.bonusTotal)}</p>
          )}
          <p className="mt-1 pt-0.5 border-t border-white/15 text-[7px] text-emerald-100 font-bold truncate">
            Cair: <b className="text-white">{formatRupiah(myCommissionData.totalPaid)}</b> · Belum: <b className="text-amber-200">{formatRupiah(myCommissionData.pendingBalance)}</b>
          </p>
          {otherMonthsPending > 0 && (
            <p className="text-[7px] text-amber-200 font-bold mt-0.5 truncate">
              Sisa bulan lain belum cair: {formatRupiah(otherMonthsPending)}
            </p>
          )}
        </div>

        {/* Total Kotor Card */}
        <div className="stat-card py-2.5 px-3 super-rounded flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Kotor</p>
            <span className="text-[7px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded shrink-0">Sblm Potong</span>
          </div>
          <p className="text-sm font-extrabold text-gray-900 leading-none mt-1">{formatRupiah(grossRevenue)}</p>
          <p className="text-[8px] text-gray-400 font-medium mt-0.5">{lunasTrxCount} transaksi lunas</p>
        </div>

        {/* Progres Penagihan Card */}
        <div className="stat-card py-2.5 px-3 super-rounded flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Progres</p>
            <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{activePaidPercent}%</span>
          </div>

          <div className="flex items-center justify-between mt-1 leading-none">
            <span className="text-[11px] font-bold text-gray-800">{paidCustomers.length} <span className="text-[8px] font-medium text-gray-400">/ {totalActiveCustomers} plg</span></span>
            <div className="flex items-center gap-1 text-[7px] shrink-0">
              <span className="px-1 py-0.5 bg-[#ebfbf3] text-[#0ea569] rounded font-bold">{paidCustomers.length} Lunas</span>
              <span className="px-1 py-0.5 bg-[#fef3c7] text-[#f95f00] rounded font-bold">{unpaidCustomers.length} Belum</span>
            </div>
          </div>

          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${activePaidPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-bold">
            <span className="text-emerald-600">{paidCustomers.length} Lunas</span>
            <span className="text-amber-600">{unpaidCustomers.length} Belum Bayar</span>
          </div>
        </div>

        {/* Piutang Kasbon Card — cuma tampil kalau ada transaksi KASBON di periode ini */}
        {kasbon.count > 0 && (
          <div className="bg-orange-50 border border-orange-200 p-5 super-rounded flex flex-col justify-center col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Piutang Kasbon</p>
              <span className="text-[9px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">{kasbon.count} transaksi</span>
            </div>
            <p className="text-lg font-black text-orange-600 mt-1">{formatRupiah(kasbon.shortfall)}</p>
            <p className="text-[9px] text-gray-400 mt-1 italic font-medium leading-none">Kekurangan bayar pelanggan, belum ditutup</p>
          </div>
        )}
      </div>

      {/* Banner "Barusan" (transaksi sukses terakhir) */}
      {latestSuccess && (
        <div
          onClick={() => latestSuccess.type === 'instansi' ? setInstansiReceiptToView(latestSuccess) : setReceiptToView(latestSuccess)}
          className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-green-600 shrink-0">
              <CheckCircle size={15} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-white/70 px-1.5 py-0.5 rounded shrink-0">Barusan</span>
              <span className="text-xs font-bold text-gray-900 truncate">
                {latestSuccess.type === 'instansi' ? latestSuccess.instansiName : latestSuccess.customerName}
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-green-600 shrink-0">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {latestSuccess.payment_method === 'CS' ? 'Sukses CS' : 'Sukses'}
              </span>
            </div>
          </div>
          <span className="text-xs font-extrabold text-gray-900 shrink-0">{formatRupiah(latestSuccess.price)}</span>
        </div>
      )}
      </>
      )}

      {/* Peta + jalur rute kunjungan dan tujuan berikutnya (selalu tampil, termasuk saat embedded) */}
      <RouteOverview customers={customers} transactions={transactions} visits={visits} onAddVisit={onAddVisit} canManageRoute={canManageRoute} origin={origin} myPosition={myPosition} locationStatus={locationStatus} adminLocations={adminLocations} onRetryLocation={onRetryLocation} />

      {/* Pengingat Tagihan (due-date reminders, always real-time) — disembunyikan saat embedded,
          DashboardSuperadmin.jsx punya versi barunya sendiri (Tagihan & Pengingat Pelanggan) */}
      {!embedded && reminderList.length > 0 && (
        <div id="reminder-section">
          <div className="flex items-center justify-between mb-2 ml-1">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <span>⏰ Pengingat Tagihan & Isolir</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[9px]">
                {reminderList.length}
              </span>
            </h2>
            {reminderList.some(c => c.phone) && (
              <button
                type="button"
                onClick={() => sendBatchReminders(reminderList)}
                disabled={isSendingBatch}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1 rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                title="Kirim pengingat tagihan dan peringatan isolir otomatis ke semua pelanggan ber-nomor WA"
              >
                <Send size={11} />
                <span>{isSendingBatch ? 'Mengirim Masal...' : 'Kirim WA Masal (H-2 / H-1)'}</span>
              </button>
            )}
          </div>

          {reminderFeedback && (
            <div className={`mb-3 p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
              reminderFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              reminderFeedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>{reminderFeedback.message}</span>
              </div>
              <button onClick={() => setReminderFeedback(null)} className="text-gray-400 hover:text-gray-600 text-[10px] ml-2 font-bold">✕</button>
            </div>
          )}

          <div className="bg-white p-5 super-rounded border border-gray-100 shadow-sm">
            <div className="space-y-2">
              {(reminderExpanded ? reminderList : reminderList.slice(0, 5)).map(cust => {
                const badge = getReminderBadge(cust.dueDiff);
                const isItemSending = sendingReminderId === cust.id;
                return (
                  <div key={cust.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/60 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-800 text-xs leading-tight truncate">{cust.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {cust.package} · Tgl {cust.due_date || '-'} {cust.phone ? `· ${cust.phone}` : '· (Tanpa WA)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${badge.className}`}>
                        {badge.text}
                      </span>
                      {cust.phone && (
                        <button
                          type="button"
                          onClick={() => sendSingleReminder(cust)}
                          disabled={isItemSending || isSendingBatch}
                          title="Kirim pesan pengingat jatuh tempo & peringatan isolir via WhatsApp"
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                        >
                          <MessageCircle size={12} className={isItemSending ? 'animate-spin' : ''} />
                          <span>{isItemSending ? 'Mengirim...' : 'Kirim WA'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {reminderList.length > 5 && (
              <button
                onClick={() => setReminderExpanded(v => !v)}
                className="w-full text-center text-[10px] font-bold text-blue-600 mt-2 py-1.5 hover:underline"
              >
                {reminderExpanded ? 'Tutup' : `Lihat Selengkapnya (${reminderList.length - 5})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Revenue Chart Section — disembunyikan saat embedded, superadmin punya chart Omset sendiri */}
      {!embedded && (
      <div>
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Pendapatan 6 Bulan Terakhir</h2>
        <div className="bg-white p-5 super-rounded border border-gray-100 shadow-sm">
          <RevenueBarChart data={revenueChartData} />
        </div>
      </div>
      )}

      {/* Payment Status Section — disembunyikan saat embedded, DashboardSuperadmin.jsx punya versinya sendiri */}
      {!embedded && (
      <div>
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Status Pembayaran Bulan Ini</h2>
        <div className="bg-white p-5 super-rounded border border-gray-100 shadow-sm">
          {totalActiveCustomers > 0 ? (
            <>
              <PaymentStatusDonut paidCount={paidCustomers.length} unpaidCount={unpaidCustomers.length} />

              <div className="flex gap-2 mt-5 mb-3">
                <button
                  onClick={() => setActivePaymentTab('unpaid')}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${activePaymentTab === 'unpaid' ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-50 text-gray-500'}`}
                >
                  Belum Bayar ({unpaidCustomers.length})
                </button>
                <button
                  onClick={() => setActivePaymentTab('paid')}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${activePaymentTab === 'paid' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-50 text-gray-500'}`}
                >
                  Sudah Bayar ({paidCustomers.length})
                </button>
              </div>

              {(() => {
                const activeList = activePaymentTab === 'unpaid' ? unpaidCustomers : paidCustomers;
                const isExpanded = activePaymentTab === 'unpaid' ? unpaidExpanded : paidExpanded;
                const visibleList = isExpanded ? activeList : activeList.slice(0, 5);
                const toggleExpanded = () => {
                  if (activePaymentTab === 'unpaid') setUnpaidExpanded(v => !v);
                  else setPaidExpanded(v => !v);
                };

                return (
                  <div className="space-y-2">
                    {activeList.length > 0 ? (
                      visibleList.map(cust => (
                        <div key={cust.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
                          <div>
                            <p className="font-bold text-gray-800 text-xs leading-tight">{cust.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{cust.package}</p>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${activePaymentTab === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {activePaymentTab === 'paid' ? 'Lunas' : 'Belum Bayar'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-400 text-xs font-medium py-6">
                        {activePaymentTab === 'unpaid' ? 'Semua pelanggan sudah bayar bulan ini 🎉' : 'Belum ada pelanggan yang membayar bulan ini'}
                      </p>
                    )}

                    {activeList.length > 5 && (
                      <button
                        onClick={toggleExpanded}
                        className="w-full text-center text-[10px] font-bold text-blue-600 mt-2 py-1.5 hover:underline"
                      >
                        {isExpanded ? 'Tutup' : `Lihat Selengkapnya (${activeList.length - 5})`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-center text-gray-400 text-xs font-medium py-6">Belum ada pelanggan aktif</p>
          )}
        </div>
      </div>
      )}

      {/* Transaction List — disembunyikan saat embedded, superadmin punya section
          "Aktivitas Transaksi Terbaru" sendiri di DashboardSuperadmin.jsx */}
      {!embedded && (
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
      )}

      {/* Modal Riwayat Pencairan Komisi */}
      {showCommissionHistoryModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdrop" onClick={() => setShowCommissionHistoryModal(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-4 animate-sheet-up sm:animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowCommissionHistoryModal(false)}
              aria-label="Tutup"
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"
            >
              <X size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-gray-900">Riwayat Pencairan Komisi</h3>
                  <p className="text-xs text-gray-500">Pencairan komisi jasa kasir yang dikirim Super Admin</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <div className="p-2 bg-white rounded-lg shadow-xs">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Hak Komisi</p>
                <p className="text-[8px] text-gray-400">{commissionMonthLabel}</p>
                <p className="text-sm font-black text-gray-900">{formatRupiah(myCommissionData.totalEarned)}</p>
              </div>
              <div className="p-2 bg-white rounded-lg shadow-xs">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Sudah Cair</p>
                <p className="text-sm font-black text-emerald-600">{formatRupiah(myCommissionData.totalPaid)}</p>
              </div>
              <div className="p-2 bg-white rounded-lg shadow-xs">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Belum Cair</p>
                <p className="text-sm font-black text-amber-600">{formatRupiah(myCommissionData.pendingBalance)}</p>
              </div>
            </div>

            <div className="space-y-1.5 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1"><Info size={11} /> Cara hitung</p>
              <ul className="space-y-1 text-[11px] text-gray-700 leading-snug list-disc pl-4">
                {commissionNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rincian per Bulan</p>
              {commissionMonths.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">Belum ada transaksi yang dihitung sebagai komisi.</p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {commissionMonths.map((month) => (
                    <div key={month.key} className={`px-3 py-2 text-xs ${month.key === commissionPeriod ? 'bg-emerald-50/60' : 'bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700">{month.label}</span>
                        <span className="text-gray-500">
                          {month.count} trx × {formatRupiah(myCommissionData.feePerTransaction)} = <b className="text-gray-900">{formatRupiah(month.auto)}</b>
                        </span>
                      </div>
                      {month.bonus > 0 && (
                        <div className="flex items-center justify-between text-[10px] mt-0.5">
                          <span className="text-amber-700 font-semibold">+ Tambahan dari Superadmin</span>
                          <b className="text-amber-700">{formatRupiah(month.bonus)}</b>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] mt-0.5">
                        <span className="text-emerald-700">Sudah cair: {formatRupiah(month.paid)}</span>
                        <span className={month.pending > 0 ? 'text-amber-700 font-bold' : 'text-gray-400'}>Belum cair: {formatRupiah(month.pending)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 text-xs bg-gray-50 font-black text-gray-900">
                    <span>Total semua bulan</span>
                    <span>
                      {commissionMonths.reduce((sum, month) => sum + month.count, 0)} trx = {formatRupiah(commissionMonths.reduce((sum, month) => sum + month.auto, 0))}
                      {commissionMonths.some((month) => month.bonus > 0) && (
                        <> + tambahan {formatRupiah(commissionMonths.reduce((sum, month) => sum + month.bonus, 0))}</>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {myCommissionData.allBonuses.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tambahan Komisi dari Superadmin</p>
                <div className="divide-y divide-amber-100 border border-amber-100 rounded-xl overflow-hidden bg-amber-50/40">
                  {[...myCommissionData.allBonuses]
                    .sort((a, b) => new Date(b.given_at || 0) - new Date(a.given_at || 0))
                    .map((bonus) => (
                      <div key={bonus.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{bonus.notes}</p>
                          <p className="text-[10px] text-gray-500">
                            Untuk {monthLabel(bonusPeriodKey(bonus))}{bonus.given_by_name ? ` · oleh ${bonus.given_by_name}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-black text-amber-700 shrink-0">+{formatRupiah(bonus.amount)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Daftar Pengiriman</p>
              {myCommissionData.history.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6 bg-gray-50 rounded-xl">Belum ada riwayat transfer.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {myCommissionData.history.map((item) => (
                    <div key={item.id} className="p-3 bg-white border border-gray-100 rounded-xl shadow-xs flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{item.notes || 'Pencairan Komisi'}</p>
                        <p className="text-[10px] font-semibold text-emerald-700">Untuk komisi {monthLabel(payoutPeriodKey(item))}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(item.sent_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {item.payment_method ? ` · ${item.payment_method}` : ''}
                        </p>
                        {item.sent_by_name && (
                          <p className="text-[9px] text-gray-400">Oleh: <span className="font-semibold text-gray-600">{item.sent_by_name}</span></p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-600">+{formatRupiah(item.amount)}</p>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          ✅ DITRANSFER
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
