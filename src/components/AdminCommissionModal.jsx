import { useEffect, useState } from 'react';
import {
  X, Send, CheckCircle2, Loader2, DollarSign, CreditCard, History, AlertCircle, Trash2, Gift,
  ChevronLeft, ChevronRight, ChevronDown, Copy,
} from 'lucide-react';
import { formatRupiah } from '../utils/format';
import {
  calculateAdminCommissions, commissionByMonth, createCommissionPayout, recordCommissionPayout,
  createCommissionBonus, recordCommissionBonus, removeCommissionBonus, removeCommissionPayout, buildCommissionRecap,
  monthKey, monthLabel, payoutPeriodKey,
} from '../utils/commissions';
import { normalizeAdminAccess } from '../utils/permissions';
import { parseMoney } from '../utils/money';
import MoneyInput from './MoneyInput';

const PAYMENT_METHODS = [
  'Transfer Bank (BCA)',
  'Transfer Bank (BRI)',
  'Transfer Bank (Mandiri)',
  'Transfer Bank (BNI)',
  'E-Wallet (Dana)',
  'E-Wallet (GoPay / OVO)',
  'Tunai / Cash',
  'Lainnya',
];

const BONUS_SHORTCUTS = [25000, 50000, 100000];

// Geser kunci bulan 'YYYY-MM' sebanyak `delta` bulan.
const shiftMonth = (key, delta) => {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
};

const inputClass = 'w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition';

const AdminCommissionModal = ({ admin, transactions = [], companyInfo = {}, session, onClose, onSaved }) => {
  const [livePaths, setLivePaths] = useState(admin.allowed_paths);
  const currentAccess = normalizeAdminAccess(livePaths);
  const commissionFee = companyInfo.adminFee || 10000;

  // Komisi dihitung dan dicairkan PER BULAN; Superadmin memilih bulan yang sedang dibayar.
  const [period, setPeriod] = useState(() => monthKey(new Date()));
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusNotes, setBonusNotes] = useState('');
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const computeFor = (targetPeriod) => calculateAdminCommissions(
    transactions,
    admin.id,
    admin.full_name,
    commissionFee,
    currentAccess.commissions || [],
    admin.role,
    targetPeriod,
    currentAccess.bonuses || []
  );
  const commissionData = computeFor(period);
  const currentMonth = monthKey(new Date());

  const monthOptions = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth, -i));
  if (!monthOptions.includes(period)) monthOptions.push(period);

  const monthRows = commissionByMonth(
    transactions, admin.id, admin.full_name, commissionFee, admin.role,
    currentAccess.commissions || [], currentAccess.bonuses || []
  );
  const otherPendingMonths = monthRows.filter((row) => row.key !== period && row.pending > 0);

  const numericAmount = parseMoney(amount);
  const paidPercent = commissionData.totalEarned > 0
    ? Math.min(100, Math.round((commissionData.totalPaid / commissionData.totalEarned) * 100))
    : 0;
  const exceedsPending = numericAmount > commissionData.pendingBalance;

  // Tutup dengan tombol Esc
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Pindah bulan: nominal usulan mengikuti sisa komisi bulan tersebut.
  const handlePeriodChange = (nextPeriod) => {
    setPeriod(nextPeriod);
    const next = computeFor(nextPeriod);
    setAmount(next.pendingBalance > 0 ? String(next.pendingBalance) : '');
    resetMessages();
  };

  // Isi awal nominal dengan sisa bulan berjalan (dihitung sekali saat modal dibuka)
  const [initialised, setInitialised] = useState(false);
  if (!initialised) {
    setInitialised(true);
    if (commissionData.pendingBalance > 0) setAmount(String(commissionData.pendingBalance));
  }

  const handleAddBonus = async (e) => {
    e.preventDefault();
    resetMessages();
    const numeric = parseMoney(bonusAmount);
    if (numeric <= 0) {
      setErrorMsg('Masukkan nominal tambahan komisi yang valid.');
      return;
    }
    setIsSavingBonus(true);
    try {
      const bonus = createCommissionBonus({
        adminId: admin.id,
        adminName: admin.full_name,
        amount: numeric,
        period,
        notes: bonusNotes.trim(),
        givenByName: session?.profile?.full_name || 'Super Admin',
      });
      const updated = await recordCommissionBonus({ ...admin, allowed_paths: livePaths }, bonus);
      setLivePaths(updated);
      setBonusAmount('');
      setBonusNotes('');
      setSuccessMsg(`Tambahan komisi ${formatRupiah(numeric)} untuk ${monthLabel(period)} berhasil dicatat.`);
      onSaved?.();
    } catch (err) {
      setErrorMsg('Gagal menyimpan tambahan komisi: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSavingBonus(false);
    }
  };

  const handleRemoveBonus = async (bonusId) => {
    if (!window.confirm('Batalkan tambahan komisi ini?')) return;
    resetMessages();
    try {
      const updated = await removeCommissionBonus({ ...admin, allowed_paths: livePaths }, bonusId);
      setLivePaths(updated);
      onSaved?.();
    } catch (err) {
      setErrorMsg('Gagal membatalkan tambahan komisi: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  const handleRemovePayout = async (item) => {
    const confirmed = window.confirm(
      `Hapus pencairan ${formatRupiah(item.amount)} untuk komisi ${monthLabel(payoutPeriodKey(item))}? Saldo belum cair bulan itu akan bertambah kembali.`
    );
    if (!confirmed) return;
    resetMessages();
    try {
      const updated = await removeCommissionPayout({ ...admin, allowed_paths: livePaths }, item.id);
      setLivePaths(updated);
      setSuccessMsg(`Pencairan ${formatRupiah(item.amount)} dihapus.`);
      onSaved?.();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Gagal menghapus pencairan: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  // Salin rekap bulan terpilih (teks siap kirim ke WhatsApp)
  const handleCopyRecap = async () => {
    resetMessages();
    try {
      await navigator.clipboard.writeText(buildCommissionRecap(admin.full_name, commissionData));
      setSuccessMsg(`Rekap komisi ${monthLabel(period)} disalin. Tinggal tempel di WhatsApp.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Rekap tidak bisa disalin di perangkat ini.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (numericAmount <= 0) {
      setErrorMsg('Masukkan nominal komisi yang valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payout = createCommissionPayout({
        adminId: admin.id,
        adminName: admin.full_name,
        amount: numericAmount,
        paymentMethod,
        notes: notes.trim() || `Pencairan komisi ${monthLabel(period)}`,
        sentByName: session?.profile?.full_name || 'Super Admin',
        period,
      });

      const updated = await recordCommissionPayout({ ...admin, allowed_paths: livePaths }, payout);
      setLivePaths(updated);

      setSuccessMsg(`Komisi sebesar ${formatRupiah(numericAmount)} untuk ${monthLabel(period)} berhasil dikirim dan dicatat!`);
      setAmount('');
      setNotes('');
      onSaved?.();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Gagal mengirim komisi: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="commission-title"
        className="w-full max-w-lg max-h-[94vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-sheet-up sm:animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: judul + navigasi bulan */}
        <header className="px-5 pt-5 pb-3 space-y-3 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign size={20} />
              </span>
              <div className="min-w-0">
                <h3 id="commission-title" className="text-base font-black text-gray-900 leading-tight">Kelola & Kirim Komisi</h3>
                <p className="text-xs text-gray-500 truncate">{admin.full_name}{admin.email ? ` · ${admin.email}` : ''}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePeriodChange(shiftMonth(period, -1))}
              aria-label="Bulan sebelumnya"
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1">
              <label htmlFor="commission-period" className="sr-only">Bulan komisi</label>
              <select
                id="commission-period"
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-black text-gray-800 text-center focus:border-emerald-500"
              >
                {monthOptions.map((key) => (
                  <option key={key} value={key}>{monthLabel(key)}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => handlePeriodChange(shiftMonth(period, 1))}
              disabled={period >= currentMonth}
              aria-label="Bulan berikutnya"
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        {/* Isi yang bisa digulir */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errorMsg && (
            <div role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-px" /> <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div role="status" className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-start gap-2">
              <CheckCircle2 size={15} className="shrink-0 mt-px" /> <span>{successMsg}</span>
            </div>
          )}

          {/* Ringkasan komisi bulan terpilih */}
          <section aria-label="Ringkasan komisi" className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-4 space-y-3 shadow-md shadow-emerald-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-emerald-100">Hak Komisi · {monthLabel(period)}</p>
                <p className="text-2xl font-black tracking-tight leading-tight">{formatRupiah(commissionData.totalEarned)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-full whitespace-nowrap">
                  {commissionData.earnedTrxCount} transaksi
                </span>
                <button
                  type="button"
                  onClick={handleCopyRecap}
                  className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full flex items-center gap-1 active:scale-95 transition"
                >
                  <Copy size={10} /> Salin rekap
                </button>
              </div>
            </div>
            <p className="text-[11px] text-emerald-50 leading-snug">
              Otomatis {commissionData.earnedTrxCount} × {formatRupiah(commissionData.feePerTransaction)} = <b>{formatRupiah(commissionData.autoEarned)}</b>
              {commissionData.bonusTotal > 0 && <> · Tambahan Superadmin <b>{formatRupiah(commissionData.bonusTotal)}</b></>}
            </p>
            <div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden" role="progressbar" aria-valuenow={paidPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Komisi yang sudah cair">
                <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${paidPercent}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div className="bg-white/15 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-semibold text-emerald-100">Sudah Cair</p>
                  <p className="text-sm font-black">{formatRupiah(commissionData.totalPaid)}</p>
                  <p className="text-[10px] text-emerald-100">{commissionData.periodHistory.length} x Transfer</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-semibold text-amber-100">Belum Cair</p>
                  <p className="text-sm font-black">{formatRupiah(commissionData.pendingBalance)}</p>
                  <p className="text-[10px] text-emerald-100">{commissionData.pendingBalance > 0 ? 'Siap ditransfer' : 'Lunas'}</p>
                </div>
              </div>
            </div>
          </section>

          {otherPendingMonths.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] text-amber-800 font-semibold">Masih ada komisi belum cair di bulan lain. Pilih untuk membuka:</p>
              <div className="flex flex-wrap gap-1.5">
                {otherPendingMonths.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => handlePeriodChange(row.key)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 active:scale-95 transition"
                  >
                    {row.label} · {formatRupiah(row.pending)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tambahan komisi dari Superadmin (bisa dilipat) */}
          <section className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBonus((open) => !open)}
              aria-expanded={showBonus}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left hover:bg-amber-50 transition"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Gift size={14} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-black text-amber-900">Tambahan Komisi</span>
                  <span className="block text-[11px] text-amber-700">
                    {commissionData.periodBonuses.length > 0
                      ? `${commissionData.periodBonuses.length} tambahan · ${formatRupiah(commissionData.bonusTotal)} di ${monthLabel(period)}`
                      : `Belum ada tambahan di ${monthLabel(period)}`}
                  </span>
                </span>
              </span>
              <ChevronDown size={16} className={`text-amber-700 shrink-0 transition-transform ${showBonus ? 'rotate-180' : ''}`} />
            </button>

            <div className={showBonus ? 'px-3.5 pb-3.5 space-y-3' : 'hidden'}>
              <p className="text-[11px] text-gray-600 leading-snug">
                Komisi otomatis sudah dihitung sendiri. Isi di sini bila kamu ingin memberi tambahan untuk admin ini di bulan {monthLabel(period)}.
              </p>

              {commissionData.periodBonuses.length > 0 && (
                <ul className="space-y-1.5">
                  {commissionData.periodBonuses.map((bonus) => (
                    <li key={bonus.id} className="flex items-center justify-between gap-2 p-2.5 bg-white border border-amber-100 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{bonus.notes}</p>
                        <p className="text-[10px] text-gray-400">Oleh {bonus.given_by_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-amber-700">+{formatRupiah(bonus.amount)}</span>
                        <button type="button" onClick={() => handleRemoveBonus(bonus.id)} aria-label="Batalkan tambahan" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddBonus} className="space-y-2">
                <MoneyInput
                  value={bonusAmount}
                  onValueChange={setBonusAmount}
                  prefix="Rp"
                  placeholder="Nominal tambahan"
                  aria-label="Nominal tambahan komisi"
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-1.5" aria-label="Nominal cepat">
                  {BONUS_SHORTCUTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBonusAmount(String(parseMoney(bonusAmount) + value))}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 active:scale-95 transition"
                    >
                      +{formatRupiah(value).replace('Rp ', '')}
                    </button>
                  ))}
                  {bonusAmount && (
                    <button type="button" onClick={() => setBonusAmount('')} className="text-[11px] font-semibold px-2 py-1 text-gray-500 hover:text-gray-700">
                      Kosongkan
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={bonusNotes}
                  onChange={(e) => setBonusNotes(e.target.value)}
                  placeholder="Keterangan (misal: target tercapai)"
                  aria-label="Keterangan tambahan komisi"
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium text-gray-800 focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={isSavingBonus || parseMoney(bonusAmount) <= 0}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSavingBonus ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                  {isSavingBonus ? 'Menyimpan...' : 'Tambahkan'}
                </button>
              </form>
            </div>
          </section>

          {/* Kirim komisi */}
          <form id="commission-payout-form" onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 p-3.5 space-y-3">
            <p className="text-xs font-black text-gray-700 flex items-center gap-2">
              <CreditCard size={14} className="text-emerald-600" /> Kirim Komisi · {monthLabel(period)}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="commission-amount" className="block text-[11px] font-bold text-gray-500">Nominal dikirim</label>
              <MoneyInput
                id="commission-amount"
                value={amount}
                onValueChange={setAmount}
                prefix="Rp"
                placeholder="0"
                aria-label="Nominal komisi yang dikirim"
                className={`${inputClass} text-lg`}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {commissionData.pendingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(commissionData.pendingBalance))}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95 transition"
                  >
                    Kirim semua sisa · {formatRupiah(commissionData.pendingBalance)}
                  </button>
                )}
                {amount && (
                  <button type="button" onClick={() => setAmount('')} className="text-[11px] font-semibold px-2 py-1 text-gray-500 hover:text-gray-700">
                    Kosongkan
                  </button>
                )}
              </div>
              {commissionData.pendingBalance === 0 && numericAmount === 0 && (
                <p className="text-[11px] text-emerald-700">Komisi {monthLabel(period)} sudah lunas. Tidak ada sisa yang perlu dikirim.</p>
              )}
              {exceedsPending && (
                <p role="note" className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                  Nominal melebihi sisa komisi {monthLabel(period)} ({formatRupiah(commissionData.pendingBalance)}). Pastikan ini disengaja.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label htmlFor="commission-method" className="block text-[11px] font-bold text-gray-500">Metode pembayaran</label>
                <select
                  id="commission-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-700 focus:border-emerald-500"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="commission-notes" className="block text-[11px] font-bold text-gray-500">Keterangan (opsional)</label>
                <input
                  id="commission-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={`Komisi ${monthLabel(period)}`}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium text-gray-800 focus:border-emerald-500"
                />
              </div>
            </div>
          </form>

          {/* Riwayat pencairan */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-gray-500 flex items-center gap-1.5">
                <History size={13} /> Riwayat Pencairan
              </p>
              <span className="text-[10px] text-gray-400">{commissionData.history.length} catatan</span>
            </div>

            {commissionData.history.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">Belum ada riwayat transfer komisi.</p>
            ) : (
              <ul className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {commissionData.history.map((item) => (
                  <li key={item.id} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{item.notes || 'Pencairan Komisi'}</p>
                      <p className="text-[10px] font-semibold text-emerald-700">Untuk komisi {monthLabel(payoutPeriodKey(item))}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                        <span>{new Date(item.sent_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>·</span>
                        <span className="font-semibold text-gray-600">{item.payment_method}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">+{formatRupiah(item.amount)}</p>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">✅ TERKIRIM</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePayout(item)}
                        aria-label="Hapus pencairan"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Tombol kirim selalu terlihat */}
        <footer className="px-5 py-3 border-t border-gray-100 bg-white shrink-0">
          <button
            type="submit"
            form="commission-payout-form"
            disabled={isSubmitting || numericAmount <= 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-emerald-100"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isSubmitting ? 'Memproses...' : 'Kirim & Catat Komisi'}
            {!isSubmitting && numericAmount > 0 && <span className="font-bold opacity-90">· {formatRupiah(numericAmount)}</span>}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AdminCommissionModal;
