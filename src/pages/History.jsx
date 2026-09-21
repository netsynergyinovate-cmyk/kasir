import { useState, useEffect } from 'react';
import { Search, Calendar, Filter, FileText, Building2, ChevronRight, Trash2, RefreshCw, Camera, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatRupiah, getInvoiceNumber } from '../utils/format';
import { runsnetCodeOf, describeRunsnetStatus, isRunsnetMismatch } from '../utils/runsnetStatus';
import RunsnetProofModal from '../components/RunsnetProofModal';

const History = ({ transactions, role, session, setReceiptToView, setInstansiReceiptToView, onDeleteTransaction }) => {
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

  // Status NYATA di Runsnet untuk transaksi yang tampil (dibaca langsung dari Runsnet, bukan dari catatan KAsir).
  const [runsnetStatuses, setRunsnetStatuses] = useState({});
  const [checkedKey, setCheckedKey] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [checkError, setCheckError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [proofIds, setProofIds] = useState(new Set());
  const [proofTrx, setProofTrx] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [checkedTimes, setCheckedTimes] = useState({});

  const codes = [...new Set(filteredTransactions.filter((t) => t.type !== 'instansi').map(runsnetCodeOf).filter(Boolean))].slice(0, 60);
  const requestKey = `${codes.join(',')}#${refreshTick}`;
  const checking = codes.length > 0 && checkedKey !== requestKey;
  const accessToken = session?.access_token;

  useEffect(() => {
    if (codes.length === 0 || !accessToken) return undefined;
    let cancelled = false;
    (async () => {
      let statuses = {};
      let error = null;
      let at = null;
      try {
        const response = await fetch('/api/runsnet/invoice-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ codes }),
        });
        const result = await response.json();
        if (!response.ok || result.error) error = result.error || `HTTP ${response.status}`;
        statuses = result.statuses || {};
        at = result.checkedAt || new Date().toISOString();
      } catch (err) {
        error = err.message;
      }
      if (cancelled) return;
      setRunsnetStatuses((prev) => ({ ...prev, ...statuses }));
      setCheckError(error);
      if (!error) setCheckedAt(at);
      setCheckedKey(requestKey);
    })();
    return () => { cancelled = true; };
    // requestKey sudah mewakili isi codes + tombol "Cek ulang".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, accessToken]);

  useEffect(() => {
    let cancelled = false;
    supabase.from('runsnet_proofs').select('transaction_id').then(({ data }) => {
      if (!cancelled && data) setProofIds(new Set(data.map((r) => r.transaction_id)));
    });
    return () => { cancelled = true; };
  }, []);

  const mismatchCount = filteredTransactions.filter((t) => isRunsnetMismatch(t, runsnetStatuses[runsnetCodeOf(t)])).length;
  const recheck = async () => setRefreshTick((n) => n + 1);

  // Hapus transaksi. Kalau transaksi retail punya invoice Runsnet, pembayarannya di Runsnet ikut dibatalkan
  // (reversal) DULU; transaksi baru dihapus dari KAsir kalau reversal berhasil / memang tidak diperlukan, supaya
  // KAsir dan Runsnet tidak berbeda. Kalau reversal tidak bisa dijalankan, superadmin memilih sendiri apakah tetap
  // menghapus dari KAsir saja (pembayaran di Runsnet TETAP ada).
  const handleDelete = async (trx) => {
    const code = trx.type !== 'instansi' ? runsnetCodeOf(trx) : null;
    if (!code) {
      if (window.confirm('Hapus permanen riwayat transaksi ini?')) onDeleteTransaction(trx.id);
      return;
    }

    const known = runsnetStatuses[code];
    const warning = known === 'PAID'
      ? 'Transaksi ini SUDAH PAID di Runsnet.\n\nMenghapusnya akan juga MEMBATALKAN (reversal) pembayaran itu di Runsnet, lalu menghapus riwayat di KAsir. Lanjutkan?'
      : 'Hapus permanen riwayat transaksi ini?\n\nJika pembayarannya sudah PAID di Runsnet, pembayaran itu juga akan DIBATALKAN (reversal) di Runsnet.';
    if (!window.confirm(warning)) return;

    setDeletingId(trx.id);
    let result = null;
    let problem = null;
    try {
      const response = await fetch('/api/runsnet/reverse-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ transactionId: trx.id }),
      });
      result = await response.json();
      if (!response.ok) problem = result.error || `HTTP ${response.status}`;
    } catch (err) {
      problem = 'Tidak bisa menghubungi server: ' + err.message;
    }

    const reversed = !problem && (result.skipped === 'no_runsnet_invoice' || result.status === 'success');
    if (!reversed) {
      const reason = problem || result.message || 'Reversal tidak dijalankan.';
      const keepGoing = window.confirm(`Reversal di Runsnet TIDAK berhasil dijalankan:\n${reason}\n\nTetap hapus dari KAsir saja? Pembayaran di Runsnet akan TETAP ADA.`);
      if (!keepGoing) {
        setDeletingId(null);
        return;
      }
    }

    await onDeleteTransaction(trx.id);
    setDeletingId(null);
    if (reversed && result?.message) alert('Reversal Runsnet: ' + result.message);
  };

  // Cek status PAID satu transaksi saja (tombol di tiap kartu): membaca ulang invoice itu langsung dari Runsnet.
  const checkOne = async (trx) => {
    const code = runsnetCodeOf(trx);
    if (!code || !accessToken) return;
    setCheckingId(trx.id);
    try {
      const response = await fetch('/api/runsnet/invoice-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ codes: [code] }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert('Gagal membaca Runsnet: ' + (result.error || `HTTP ${response.status}`));
      } else {
        setRunsnetStatuses((prev) => ({ ...prev, ...result.statuses }));
        setCheckedTimes((prev) => ({ ...prev, [trx.id]: result.checkedAt || new Date().toISOString() }));
      }
    } catch (err) {
      alert('Gagal menghubungi server: ' + err.message);
    }
    setCheckingId(null);
  };
  const onProofChanged = (id, has) => setProofIds((prev) => {
    const next = new Set(prev);
    if (has) next.add(id); else next.delete(id);
    return next;
  });

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

      {/* Status Runsnet dibaca langsung dari Runsnet */}
      {codes.length > 0 && (
        <div className={`rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 text-[11px] ${checkError ? 'bg-red-50 border border-red-200 text-red-700' : mismatchCount > 0 ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-white border border-gray-100 text-gray-500'}`}>
          {(checkError || mismatchCount > 0) && <AlertTriangle size={16} className="shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">
              {checkError
                ? `Gagal membaca Runsnet: ${checkError}`
                : checking
                  ? 'Membaca status langsung dari Runsnet...'
                  : mismatchCount > 0
                    ? `${mismatchCount} transaksi sudah lunas di KAsir tapi BELUM PAID di Runsnet`
                    : 'Semua transaksi Runsnet di daftar ini sudah cocok'}
            </p>
            {checkedAt && !checkError && <p className="opacity-70">Status dibaca dari Runsnet pukul {new Date(checkedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>}
          </div>
          <button type="button" onClick={recheck} disabled={checking} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 font-bold flex items-center gap-1 disabled:opacity-50">
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> Cek ulang
          </button>
        </div>
      )}

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
                  <span className="text-[10px] font-mono text-gray-400">{getInvoiceNumber(trx)}</span>
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
                      handleDelete(trx);
                    }}
                    disabled={deletingId === trx.id}
                    className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    aria-label="Hapus transaksi"
                  >
                    {deletingId === trx.id ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
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

              {trx.type !== 'instansi' && (() => {
                const badge = describeRunsnetStatus(trx, runsnetStatuses[runsnetCodeOf(trx)]);
                const dot = badge.tone === 'ok' ? 'bg-emerald-500' : badge.tone === 'bad' ? 'bg-red-500' : badge.tone === 'warn' ? 'bg-amber-500' : 'bg-gray-300';
                const text = badge.tone === 'ok' ? 'text-emerald-700' : badge.tone === 'bad' ? 'text-red-600' : badge.tone === 'warn' ? 'text-amber-700' : 'text-gray-400';
                const hasProof = proofIds.has(trx.id);
                const hasCode = Boolean(runsnetCodeOf(trx));
                const isChecking = checkingId === trx.id;
                const checkedAtCard = checkedTimes[trx.id];
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
                    <p className={`flex items-center gap-1.5 text-[11px] font-bold ${text}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <span className="truncate">{badge.text}</span>
                      {checkedAtCard && (
                        <span className="ml-auto shrink-0 font-medium text-gray-400">
                          dicek {new Date(checkedAtCard).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </p>
                    <div className={`grid gap-2 ${hasCode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {hasCode && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); checkOne(trx); }}
                          disabled={isChecking}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-60"
                        >
                          <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} /> {isChecking ? 'Mengecek...' : 'Cek status PAID'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setProofTrx(trx); }}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-bold active:scale-95 transition-all ${hasProof ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        <Camera size={13} /> {hasProof ? 'Lihat bukti' : 'Unggah bukti'}
                      </button>
                    </div>
                  </div>
                );
              })()}
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

      {proofTrx && (
        <RunsnetProofModal
          transaction={proofTrx}
          runsnetStatus={runsnetStatuses[runsnetCodeOf(proofTrx)]}
          session={session}
          onClose={() => setProofTrx(null)}
          onRecheck={recheck}
          onProofChanged={onProofChanged}
        />
      )}
    </div>
  );
};

export default History;
