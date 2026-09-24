import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Calendar, Filter, FileText, Building2, ChevronRight, Trash2,
  RefreshCw, Camera, AlertTriangle, CheckCircle2, Clock, CreditCard,
  User, Globe, Zap, Tag, Check, Layers, MessageCircle
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { formatRupiah, getInvoiceNumber } from '../utils/format';
import { runsnetCodeOf, describeRunsnetStatus, isRunsnetMismatch } from '../utils/runsnetStatus';
import RunsnetProofModal from '../components/RunsnetProofModal';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} • ${timePart} WIB`;
};

const History = ({
  transactions = [],
  role,
  session,
  setReceiptToView,
  setInstansiReceiptToView,
  onDeleteTransaction,
  onUpdateTransactionInvoice,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusTab, setStatusTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem('kasir_history_tab') || 'all';
  });
  const [selectedDay, setSelectedDay] = useState(() => {
    return searchParams.get('day') || 'all';
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = searchParams.get('month');
    return m !== null && m !== undefined && m !== '' ? Number(m) : new Date().getMonth();
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const y = searchParams.get('year');
    return y !== null && y !== undefined && y !== '' ? Number(y) : new Date().getFullYear();
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return searchParams.get('q') || '';
  });

  // Helper pembaruan URL parameter tanpa merusak parameter lain
  const updateUrlParam = (key, value, defaultValue = '') => {
    setSearchParams((prev) => {
      const currentVal = prev.get(key) || '';
      const targetVal = value !== null && value !== undefined && String(value) !== defaultValue ? String(value) : '';
      if (currentVal === targetVal) return prev;

      const next = new URLSearchParams(prev);
      if (!targetVal) {
        next.delete(key);
      } else {
        next.set(key, targetVal);
      }
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    try { localStorage.setItem('kasir_history_tab', statusTab); } catch {}
    updateUrlParam('tab', statusTab, 'all');
  }, [statusTab]);

  useEffect(() => {
    updateUrlParam('day', selectedDay, 'all');
  }, [selectedDay]);

  useEffect(() => {
    updateUrlParam('month', selectedMonth, String(new Date().getMonth()));
  }, [selectedMonth]);

  useEffect(() => {
    updateUrlParam('year', selectedYear, String(new Date().getFullYear()));
  }, [selectedYear]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== searchQuery) setSearchQuery(q);
  }, [searchParams]);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Status NYATA di Runsnet untuk transaksi yang tampil (dibaca langsung dari server Runsnet)
  const [runsnetStatuses, setRunsnetStatuses] = useState({});
  const [checkedKey, setCheckedKey] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [checkError, setCheckError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [proofIds, setProofIds] = useState(new Set());
  const [proofTrx, setProofTrx] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [checkedTimes, setCheckedTimes] = useState({});

  // 1. Filter awal berdasarkan tanggal & pencarian kata kunci
  const dateFilteredTransactions = useMemo(() => {
    return transactions.filter((trx) => {
      const trxDate = new Date(trx.date);
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (trx.customerName || '').toLowerCase().includes(q) ||
        (trx.instansiName || '').toLowerCase().includes(q) ||
        (trx.id || '').toLowerCase().includes(q) ||
        (trx.invoiceNumber || trx.invoice_number || '').toLowerCase().includes(q) ||
        (trx.pppoeId || trx.pppoe_id || '').toLowerCase().includes(q) ||
        (trx.packageName || trx.package_name || '').toLowerCase().includes(q) ||
        (trx.paymentMethod || trx.payment_method || '').toLowerCase().includes(q) ||
        (trx.cashierName || trx.cashier_name || '').toLowerCase().includes(q)
      );

      const matchesMonth = trxDate.getMonth() === Number(selectedMonth);
      const matchesYear = trxDate.getFullYear() === Number(selectedYear);
      const matchesDay = selectedDay === 'all' || trxDate.getDate() === Number(selectedDay);

      return matchesSearch && matchesMonth && matchesYear && matchesDay;
    });
  }, [transactions, searchQuery, selectedMonth, selectedYear, selectedDay]);

  const isWhatsAppPayment = (trx) => {
    const method = (trx.paymentMethod || trx.payment_method || '').toLowerCase();
    const cashier = (trx.cashierName || trx.cashier_name || '').toLowerCase();
    return method.includes('wa') || method.includes('whatsapp') || cashier.includes('whatsapp') || cashier.includes('bot');
  };

  // Statistik untuk data tanggal terpilih
  const totalIncome = useMemo(
    () => dateFilteredTransactions.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0),
    [dateFilteredTransactions]
  );
  const lunasCount = useMemo(
    () => dateFilteredTransactions.filter((t) => t.status === 'LUNAS').length,
    [dateFilteredTransactions]
  );
  const waCount = useMemo(
    () => dateFilteredTransactions.filter(isWhatsAppPayment).length,
    [dateFilteredTransactions]
  );
  const kasbonCount = useMemo(
    () => dateFilteredTransactions.filter((t) => t.status === 'KASBON').length,
    [dateFilteredTransactions]
  );
  const instansiCount = useMemo(
    () => dateFilteredTransactions.filter((t) => t.type === 'instansi').length,
    [dateFilteredTransactions]
  );
  const mismatchCount = useMemo(
    () => dateFilteredTransactions.filter((t) => isRunsnetMismatch(t, runsnetStatuses[runsnetCodeOf(t)])).length,
    [dateFilteredTransactions, runsnetStatuses]
  );

  // 2. Filter lanjutan berdasarkan Tab Status
  const displayedTransactions = useMemo(() => {
    if (statusTab === 'lunas') return dateFilteredTransactions.filter((t) => t.status === 'LUNAS' && t.type !== 'instansi');
    if (statusTab === 'whatsapp') return dateFilteredTransactions.filter(isWhatsAppPayment);
    if (statusTab === 'kasbon') return dateFilteredTransactions.filter((t) => t.status === 'KASBON');
    if (statusTab === 'mismatch') return dateFilteredTransactions.filter((t) => isRunsnetMismatch(t, runsnetStatuses[runsnetCodeOf(t)]));
    if (statusTab === 'instansi') return dateFilteredTransactions.filter((t) => t.type === 'instansi');
    return dateFilteredTransactions;
  }, [dateFilteredTransactions, statusTab, runsnetStatuses]);


  // Ambil daftar kode invoice untuk dicek statusnya ke Runsnet
  const codes = useMemo(
    () => [...new Set(dateFilteredTransactions.filter((t) => t.type !== 'instansi').map(runsnetCodeOf).filter(Boolean))].slice(0, 80),
    [dateFilteredTransactions]
  );

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
  }, [requestKey, accessToken, codes]);

  useEffect(() => {
    let cancelled = false;
    const fetchProofs = () => {
      supabase.from('runsnet_proofs').select('transaction_id').then(({ data }) => {
        if (!cancelled && data) setProofIds(new Set(data.map((r) => r.transaction_id)));
      });
    };
    fetchProofs();

    const handleProofUpdate = (e) => {
      if (e?.detail?.transactionId) {
        setProofIds((prev) => new Set([...prev, e.detail.transactionId]));
      } else {
        fetchProofs();
      }
    };
    window.addEventListener('kasir:proof-updated', handleProofUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('kasir:proof-updated', handleProofUpdate);
    };
  }, []);

  const recheck = async () => setRefreshTick((n) => n + 1);

  // Cek status PAID satu transaksi saja langsung dari Runsnet
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

  // Ambil nomor invoice resmi langsung dari Runsnet dan tautkan ke transaksi ini
  const fetchAndLinkRunsnetInvoice = async (trx) => {
    if (!accessToken) return;
    const query = trx.pppoeId || trx.pppoe_id || trx.customerName || trx.custid;
    if (!query) {
      alert('Pelanggan ini tidak memiliki PPPoE ID, ID pelanggan, atau nama untuk dicari di Runsnet.');
      return;
    }
    setLinkingId(trx.id);
    try {
      const response = await fetch('/api/runsnet/invoice-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ query, transactionId: trx.id }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert('Gagal mencari invoice di Runsnet: ' + (result.error || `HTTP ${response.status}`));
      } else if (!result.invoice?.id) {
        alert(`Tidak ditemukan invoice di Runsnet untuk "${query}". Pastikan pelanggan memiliki tagihan di Runsnet.`);
      } else {
        const runsnetInvoiceNum = String(result.invoice.id);
        trx.invoiceNumber = runsnetInvoiceNum;
        trx.invoice_number = runsnetInvoiceNum;
        if (onUpdateTransactionInvoice) {
          onUpdateTransactionInvoice(trx.id, runsnetInvoiceNum);
        }
        alert(`Berhasil! Nomor invoice Runsnet #${runsnetInvoiceNum} berhasil ditautkan ke transaksi ini.`);
        await checkOne({ ...trx, invoiceNumber: runsnetInvoiceNum, invoice_number: runsnetInvoiceNum });
      }
    } catch (err) {
      alert('Gagal menghubungi server: ' + err.message);
    }
    setLinkingId(null);
  };

  // Sinkronisasi manual pembayaran langsung ke server Runsnet
  const handleSyncPayment = async (trx) => {
    if (!accessToken) return;
    setSyncingId(trx.id);
    try {
      const response = await fetch('/api/runsnet/sync-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ transactionId: trx.id }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert('Gagal menyinkronkan ke Runsnet: ' + (result.error || `HTTP ${response.status}`));
      } else {
        if (result.runsnet_ref) {
          const runsnetInvoiceNum = String(result.runsnet_ref);
          trx.invoiceNumber = runsnetInvoiceNum;
          trx.invoice_number = runsnetInvoiceNum;
          if (onUpdateTransactionInvoice) {
            onUpdateTransactionInvoice(trx.id, runsnetInvoiceNum);
          }
        }
        alert(result.message || 'Pembayaran berhasil disinkronkan ke Runsnet!');
        await checkOne(trx);
      }
    } catch (err) {
      alert('Gagal menghubungi server: ' + err.message);
    }
    setSyncingId(null);
  };

  // Hapus transaksi aman dengan Reversal di Runsnet
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

  const onProofChanged = (id, has) => setProofIds((prev) => {
    const next = new Set(prev);
    if (has) next.add(id); else next.delete(id);
    return next;
  });

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      {/* Header Halaman */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Layers size={20} className="text-blue-600" /> Riwayat Transaksi
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Daftar pembayaran, sinkronisasi Runsnet, dan rincian transaksi
          </p>
        </div>
      </div>

      {/* Rangkuman Finansial & Status Transaksi */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-xl shadow-blue-200 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Total Pendapatan Terfilter</p>
          <h2 className="text-2xl sm:text-3xl font-black mt-0.5">{formatRupiah(totalIncome)}</h2>
          <p className="text-xs text-blue-100 font-medium mt-0.5">
            {selectedDay !== 'all' ? `${selectedDay} ` : ''}{months[selectedMonth]} {selectedYear} • {dateFilteredTransactions.length} transaksi
          </p>
        </div>

        {/* Baris Ringkasan Cepat */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/20 text-center">
          <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Lunas</p>
            <p className="text-base font-black mt-0.5">{lunasCount}</p>
          </div>
          <div className={`rounded-2xl p-2.5 backdrop-blur-xs ${waCount > 0 ? 'bg-emerald-500/80 text-white font-black' : 'bg-white/10 text-white'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              <MessageCircle size={11} className="shrink-0" /> WA Auto
            </p>
            <p className="text-base font-black mt-0.5">{waCount}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Kasbon</p>
            <p className="text-base font-black mt-0.5">{kasbonCount}</p>
          </div>
          <div className={`rounded-2xl p-2.5 backdrop-blur-xs ${mismatchCount > 0 ? 'bg-amber-400 text-amber-950 font-black' : 'bg-white/10 text-white'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Beda Runsnet</p>
            <p className="text-base font-black mt-0.5">{mismatchCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Waktu & Pencarian */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-3">
        {/* Kolom Pencarian Luas */}
        <div className="bg-gray-50 flex items-center p-2.5 rounded-2xl border border-gray-100 focus-within:border-blue-500 transition-colors">
          <Search size={18} className="text-gray-400 ml-1.5 shrink-0" />
          <input
            type="search"
            placeholder="Cari pelanggan, ID, invoice, PPPoE, paket, atau kasir..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              updateUrlParam('q', e.target.value.trim(), '');
            }}
            className="bg-transparent border-none outline-none px-2.5 w-full text-xs font-semibold text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
          />
        </div>

        {/* Pemilih Hari, Bulan, Tahun */}
        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-8"
            >
              <option value="all">Semua Hari</option>
              {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>Tgl {day}</option>
              ))}
            </select>
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-8"
            >
              {months.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-8"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          </div>
        </div>

        {/* Tab Status Navigasi Cepat */}
        <div className="flex gap-1.5 p-1 bg-gray-100 rounded-2xl overflow-x-auto text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setStatusTab('all')}
            className={`flex-1 min-w-[70px] py-2 rounded-xl text-center transition-all ${statusTab === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500'}`}
          >
            Semua ({dateFilteredTransactions.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('lunas')}
            className={`flex-1 min-w-[70px] py-2 rounded-xl text-center transition-all ${statusTab === 'lunas' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500'}`}
          >
            Lunas ({lunasCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('whatsapp')}
            className={`flex-1 min-w-[90px] py-2 rounded-xl text-center transition-all flex items-center justify-center gap-1 ${
              statusTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : waCount > 0
                  ? 'bg-emerald-50 text-emerald-800 font-bold'
                  : 'text-gray-500'
            }`}
          >
            <MessageCircle size={12} className="shrink-0" />
            <span>WA Auto ({waCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('kasbon')}
            className={`flex-1 min-w-[70px] py-2 rounded-xl text-center transition-all ${statusTab === 'kasbon' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500'}`}
          >
            Kasbon ({kasbonCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('mismatch')}
            className={`flex-1 min-w-[100px] py-2 rounded-xl text-center transition-all ${
              statusTab === 'mismatch'
                ? 'bg-amber-500 text-white shadow-xs'
                : mismatchCount > 0
                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                  : 'text-gray-500'
            }`}
          >
            Beda Runsnet ({mismatchCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('instansi')}
            className={`flex-1 min-w-[75px] py-2 rounded-xl text-center transition-all ${statusTab === 'instansi' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500'}`}
          >
            Instansi ({instansiCount})
          </button>
        </div>
      </div>


      {/* Kotak Status Sinkronisasi Runsnet Global */}
      {codes.length > 0 && (
        <div className={`rounded-3xl p-4 flex items-center justify-between gap-3 text-xs shadow-xs ${
          checkError
            ? 'bg-red-50 border border-red-200 text-red-700'
            : mismatchCount > 0
              ? 'bg-amber-50 border border-amber-300 text-amber-900'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-start gap-2.5 min-w-0">
            {checkError || mismatchCount > 0 ? (
              <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
            ) : (
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
            )}
            <div className="space-y-0.5 min-w-0">
              <p className="font-black leading-tight">
                {checkError
                  ? `Gagal membaca Runsnet: ${checkError}`
                  : checking
                    ? 'Menghubungi server Runsnet untuk memverifikasi invoice...'
                    : mismatchCount > 0
                      ? `${mismatchCount} transaksi lunas di KAsir tapi BELUM PAID di Runsnet`
                      : 'Semua transaksi retail terverifikasi lunas di server Runsnet'}
              </p>
              {checkedAt && !checkError && (
                <p className="text-[11px] opacity-75">
                  Terakhir dicek langsung dari Runsnet pukul {new Date(checkedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={recheck}
            disabled={checking}
            className="shrink-0 px-3 py-2 rounded-xl bg-white text-gray-800 font-bold border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin text-blue-600' : ''} />
            <span>Cek Ulang Semua</span>
          </button>
        </div>
      )}

      {/* Daftar Kartu Transaksi */}
      <div className="space-y-3">
        {displayedTransactions.length > 0 ? (
          displayedTransactions.map((trx) => {
            const code = trx.type !== 'instansi' ? runsnetCodeOf(trx) : null;
            const runsnetStatus = code ? runsnetStatuses[code] : undefined;
            const badge = describeRunsnetStatus(trx, runsnetStatus);
            const mismatch = isRunsnetMismatch(trx, runsnetStatus);
            const hasProof = proofIds.has(trx.id);
            const isChecking = checkingId === trx.id;
            const isSyncing = syncingId === trx.id;
            const checkedAtCard = checkedTimes[trx.id];
            const pppoe = trx.pppoeId || trx.pppoe_id;
            const isWaTrx = isWhatsAppPayment(trx);

            return (
              <div
                key={trx.id}
                className={`bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all p-4 space-y-3 relative overflow-hidden card-interactive ${
                  isWaTrx ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-100'
                }`}
              >
                {/* Baris Atas: Nomor Invoice, Badge Status, Kasir, & Aksi Hapus */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {code ? (
                      <span className="font-mono text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs" title="Nomor Invoice Resmi Runsnet">
                        <Globe size={12} className="text-blue-600" /> #{code}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg" title="Nomor Transaksi Lokal KAsir">
                          {getInvoiceNumber(trx)}
                        </span>
                        {trx.type !== 'instansi' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchAndLinkRunsnetInvoice(trx);
                            }}
                            disabled={linkingId === trx.id}
                            className="text-[10px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all shadow-2xs disabled:opacity-60"
                            title="Tautkan ke nomor invoice resmi di server Runsnet"
                          >
                            <Globe size={10} className={linkingId === trx.id ? 'animate-spin' : ''} />
                            <span>{linkingId === trx.id ? 'Mencari...' : 'Tautkan Runsnet'}</span>
                          </button>
                        )}
                      </div>
                    )}
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide flex items-center gap-1 ${
                      trx.type === 'instansi'
                        ? 'bg-purple-100 text-purple-700'
                        : isWaTrx
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : trx.status === 'LUNAS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isWaTrx && <MessageCircle size={11} className="shrink-0" />}
                      <span>{trx.type === 'instansi' ? 'INSTANSI' : isWaTrx ? 'LUNAS (WA BOT)' : trx.status}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(trx.cashierName || trx.cashier_name) && (
                      <span className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg ${
                        isWaTrx ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-gray-500 bg-gray-50'
                      }`}>
                        {isWaTrx ? <MessageCircle size={11} className="text-emerald-600" /> : <User size={11} className="text-gray-400" />}
                        <span>{trx.cashierName || trx.cashier_name}</span>
                      </span>
                    )}

                    {role === 'superadmin' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(trx);
                        }}
                        disabled={deletingId === trx.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Hapus transaksi (dengan reversal Runsnet aman)"
                        aria-label="Hapus transaksi"
                      >
                        {deletingId === trx.id ? <RefreshCw size={15} className="animate-spin text-red-500" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Konten Utama: Nama Pelanggan, Waktu, Paket, PPPoE, & Harga */}
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => (trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx))}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-2xl shrink-0 ${trx.type === 'instansi' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {trx.type === 'instansi' ? <Building2 size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-black text-gray-900 text-sm sm:text-base leading-tight truncate">
                        {trx.type === 'instansi' ? (trx.instansiName || trx.instansi_name) : (trx.customerName || trx.customer_name)}
                      </p>

                      {/* Tanggal & Jam Lengkap */}
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                        <Clock size={12} className="text-gray-400 shrink-0" />
                        <span>{formatDateTime(trx.date)}</span>
                      </p>

                      {/* Chip Metadata: Nama Paket, PPPoE, Metode Bayar */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {(trx.packageName || trx.serviceName || trx.package_name) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Tag size={10} /> {trx.packageName || trx.serviceName || trx.package_name}
                          </span>
                        )}
                        {pppoe && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200">
                            <Globe size={10} /> PPPoE: {pppoe}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isWaTrx
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isWaTrx ? <MessageCircle size={10} className="text-emerald-600" /> : <CreditCard size={10} />}
                          <span>{trx.paymentMethod || trx.payment_method || 'Tunai'}</span>
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Nominal Transaksi di Sisi Kanan */}
                  <div className="text-right shrink-0">
                    <p className="font-black text-blue-700 text-base">{formatRupiah(trx.price)}</p>
                    {trx.status === 'KASBON' && Number(trx.amountPaid) > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                        Masuk: {formatRupiah(trx.amountPaid)}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx);
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 ml-auto mt-1"
                    >
                      <span>Lihat Struk</span> <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Seksi Detail Status di Runsnet (Khusus Transaksi Retail) */}
                {trx.type !== 'instansi' && (
                  <div className={`rounded-2xl p-3 border transition-all space-y-2.5 ${
                    badge.tone === 'ok'
                      ? 'bg-emerald-50/60 border-emerald-200/80'
                      : mismatch
                        ? 'bg-rose-50/70 border-rose-200'
                        : badge.tone === 'warn'
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-gray-50 border-gray-200'
                  }`}>
                    {/* Header Status Runsnet */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Globe size={14} className={badge.tone === 'ok' ? 'text-emerald-600' : badge.tone === 'bad' ? 'text-rose-600' : 'text-gray-400'} />
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">Status Runsnet:</span>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                          badge.tone === 'ok'
                            ? 'bg-emerald-100 text-emerald-800'
                            : badge.tone === 'bad'
                              ? 'bg-rose-100 text-rose-800'
                              : badge.tone === 'warn'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-200 text-gray-700'
                        }`}>
                          {badge.text}
                        </span>
                      </div>

                      {checkedAtCard && (
                        <span className="text-[10px] text-gray-400 font-medium">
                          Dicek {new Date(checkedAtCard).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Peringatan jika Terjadi Mismatch / Belum Terkirim ke Runsnet */}
                    {mismatch && (
                      <div className="bg-rose-100/90 text-rose-800 text-[11px] font-bold p-2.5 rounded-xl flex items-start gap-2">
                        <AlertTriangle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                        <p className="leading-tight">
                          Perhatian: Pembayaran sudah tercatat LUNAS di kasir, tetapi tagihan di server Runsnet masih berstatus PENDING.
                        </p>
                      </div>
                    )}

                    {/* Status Bukti Pembayaran */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`inline-flex items-center gap-1 font-bold ${hasProof ? 'text-emerald-700' : 'text-gray-400'}`}>
                        <Camera size={13} />
                        {hasProof ? (isWaTrx ? 'Foto bukti transfer WhatsApp tersimpan ✓' : 'Bukti screenshot tersimpan ✓') : 'Belum ada bukti screenshot'}
                      </span>
                    </div>

                    {/* Tombol-tombol Tindakan pada Kartu */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {/* Tombol Kirim ke Runsnet (Jika mismatch / PENDING) */}
                      {mismatch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncPayment(trx);
                          }}
                          disabled={isSyncing}
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black active:scale-95 transition-all shadow-sm disabled:opacity-60"
                        >
                          {isSyncing ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                          <span>{isSyncing ? 'Mengirim...' : 'Kirim ke Runsnet'}</span>
                        </button>
                      )}

                      {/* Tombol Cek Status Runsnet */}
                      {code ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            checkOne(trx);
                          }}
                          disabled={isChecking}
                          className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-60"
                        >
                          <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
                          <span>{isChecking ? 'Mengecek...' : 'Cek Status'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchAndLinkRunsnetInvoice(trx);
                          }}
                          disabled={linkingId === trx.id}
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black active:scale-95 transition-all shadow-xs disabled:opacity-60"
                        >
                          <Globe size={13} className={linkingId === trx.id ? 'animate-spin' : ''} />
                          <span>{linkingId === trx.id ? 'Mencari...' : 'Tautkan Invoice Runsnet'}</span>
                        </button>
                      )}

                      {/* Tombol Lihat/Unggah Bukti */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProofTrx(trx);
                        }}
                        className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold active:scale-95 transition-all ${
                          hasProof
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : isWaTrx
                              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 shadow-xs'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Camera size={13} className={!hasProof && isWaTrx ? 'text-amber-600' : ''} />
                        <span>{hasProof ? (isWaTrx ? 'Lihat Bukti WA 📸' : 'Lihat Bukti') : (isWaTrx ? '📎 Lampirkan Foto WA' : 'Unggah Bukti')}</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-gray-100 p-8">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <Search size={30} />
            </div>
            <p className="text-gray-500 text-sm font-bold">Tidak ada transaksi ditemukan</p>
            <p className="text-gray-400 text-xs">Coba sesuaikan kata kunci pencarian atau filter tanggal yang dipilih.</p>
          </div>
        )}
      </div>

      {/* Modal Bukti Pembayaran Runsnet */}
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
