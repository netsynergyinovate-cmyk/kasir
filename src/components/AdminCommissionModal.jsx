import { useState } from 'react';
import { X, Send, CheckCircle2, Loader2, DollarSign, CreditCard, History, AlertCircle } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { calculateAdminCommissions, createCommissionPayout, recordCommissionPayout } from '../utils/commissions';
import { normalizeAdminAccess } from '../utils/permissions';

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

const AdminCommissionModal = ({ admin, transactions = [], companyInfo = {}, session, onClose, onSaved }) => {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  const commissionData = calculateAdminCommissions(
    transactions,
    admin.id,
    admin.full_name,
    companyInfo.adminFee || 10000,
    currentAccess.commissions || [],
    admin.role
  );

  const [amount, setAmount] = useState(commissionData.pendingBalance > 0 ? String(commissionData.pendingBalance) : '');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendAll = () => {
    setAmount(String(commissionData.pendingBalance));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
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
        notes: notes.trim() || `Pencairan komisi per ${new Date().toLocaleDateString('id-ID')}`,
        sentByName: session?.profile?.full_name || 'Super Admin',
      });

      await recordCommissionPayout(admin, payout);

      setSuccessMsg(`Komisi sebesar ${formatRupiah(numericAmount)} berhasil dikirim dan dicatat!`);
      setAmount('');
      setNotes('');
      onSaved?.();
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (err) {
      setErrorMsg('Gagal mengirim komisi: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdrop" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-5 animate-sheet-up sm:animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
          <X size={18} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-gray-900">Kelola & Kirim Komisi</h3>
              <p className="text-xs text-gray-500">{admin.full_name}{admin.email ? ` · ${admin.email}` : ''}</p>
            </div>
          </div>
        </div>

        {/* Ringkasan Saldo Komisi */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Diperoleh</p>
            <p className="text-xs font-black text-gray-800 mt-0.5">{formatRupiah(commissionData.totalEarned)}</p>
            <p className="text-[9px] text-gray-400">{commissionData.earnedTrxCount} Trx</p>
          </div>
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Sudah Cair</p>
            <p className="text-xs font-black text-emerald-600 mt-0.5">{formatRupiah(commissionData.totalPaid)}</p>
            <p className="text-[9px] text-gray-400">{commissionData.history.length} x Transfer</p>
          </div>
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Sisa Pending</p>
            <p className="text-xs font-black text-amber-600 mt-0.5">{formatRupiah(commissionData.pendingBalance)}</p>
            <p className="text-[9px] text-gray-400">Siap Ditransfer</p>
          </div>
        </div>

        {/* Form Kirim Komisi */}
        <form onSubmit={handleSubmit} className="space-y-3.5 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={14} className="text-blue-600" /> Form Kirim Komisi
            </label>
            {commissionData.pendingBalance > 0 && (
              <button
                type="button"
                onClick={handleSendAll}
                className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                Kirim Semua Sisa
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={14} /> {successMsg}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nominal Komisi (Rp)</label>
            <input
              type="number"
              min="1000"
              step="1000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 150000"
              className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm font-black text-gray-800 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Metode Pembayaran</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-700"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Keterangan / Periode</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Komisi Sep 2026"
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium text-gray-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-md shadow-emerald-100"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {isSubmitting ? 'Memproses...' : 'Kirim & Catat Komisi'}
          </button>
        </form>

        {/* Riwayat Pengiriman Komisi */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <History size={12} /> Riwayat Pencairan Komisi
            </p>
            <span className="text-[10px] text-gray-400">{commissionData.history.length} Catatan</span>
          </div>

          {commissionData.history.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">Belum ada riwayat transfer komisi.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {commissionData.history.map((item) => (
                <div key={item.id} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{item.notes || 'Pencairan Komisi'}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                      <span>{new Date(item.sent_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      <span className="font-semibold text-gray-600">{item.payment_method}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-emerald-600">+{formatRupiah(item.amount)}</p>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                      ✅ TERKIRIM
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCommissionModal;

