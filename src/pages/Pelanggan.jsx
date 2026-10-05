import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearchParamSync } from '../hooks/useSearchParamSync';
import {
  Search, PlusCircle, Wifi, Trash2, Pencil, MapPin, LayoutGrid, List,
  Calendar, RefreshCw, Key, Phone, Network, ShieldCheck, CheckCircle2,
  ExternalLink, Info, X, MessageSquare, CreditCard, Navigation,
  AlertCircle, Filter, ChevronDown, User, Clock, Send
} from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';
import RunsnetCustomerPicker from '../components/RunsnetCustomerPicker';
import { formatRupiah } from '../utils/format';
import { TONE_BADGE_CLASSES, isPaidThisMonth } from '../utils/visits';
import { formatDueReminderMessage } from '../utils/whatsappTemplates';

// Helper avatar color & initials
const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600'
];

const ITEMS_PER_PAGE = 6;

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Pelanggan = ({
  customers = [],
  transactions = [],
  packages = [],
  companyInfo = {},
  setReceiptToView,
  role,
  session,
  onRunsnetImported,
  visitStatusById = {},
  setShowAddCustomer,
  onDeleteCustomer,
  onUpdateCustomer,
  onSyncEbilling
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRunsnetPicker, setShowRunsnetPicker] = useState(false);

  // Tab & Filter States yang tersimpan presisten (URL param & LocalStorage)
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem('kasir_pelanggan_tab') || 'all';
  });
  const [selectedPackage, setSelectedPackage] = useState(() => searchParams.get('pkg') || '');
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'name_asc');
  const [viewMode, setViewMode] = useState(() => {
    return searchParams.get('view') || localStorage.getItem('kasir_pelanggan_view') || 'grid';
  });
  const [currentPage, setCurrentPage] = useState(1);

  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedDetailCust, setSelectedDetailCust] = useState(null);
  const [detailModalTab, setDetailModalTab] = useState('tech'); // 'tech' | 'history' | 'location'
  
  // Dropdown States for Header & Filters
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  const actionDropdownRef = useRef(null);

  // WhatsApp Template Modal State
  const [waModalCust, setWaModalCust] = useState(null);
  const [waTemplateType, setWaTemplateType] = useState('reminder'); // 'reminder' | 'paid' | 'maintenance' | 'custom'
  const [waCustomText] = useState('');
  const [isSendingWaApi, setIsSendingWaApi] = useState(false);

  // Helper pembaruan URL parameter tanpa menghapus parameter lain
  const updateUrlParam = (key, value, defaultValue = '') => {
    setSearchParams((prev) => {
      const currentVal = prev.get(key) || '';
      const targetVal = value && value !== defaultValue ? String(value) : '';
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

  // Sinkronisasi state tab/filter ke URL (dan LocalStorage untuk tab & tampilan)
  useSearchParamSync(setSearchParams, 'tab', activeTab, 'all', 'kasir_pelanggan_tab');
  useSearchParamSync(setSearchParams, 'view', viewMode, 'grid', 'kasir_pelanggan_view');
  useSearchParamSync(setSearchParams, 'pkg', selectedPackage, '');
  useSearchParamSync(setSearchParams, 'sort', sortBy, 'name_asc');

  // Buka kembali modal detail pelanggan jika URL memuat ?detail=... saat halaman dibuka (misal refresh).
  // Dilakukan sekali, begitu daftar pelanggan tersedia; disesuaikan saat render, bukan di effect.
  const [detailRestored, setDetailRestored] = useState(false);
  if (!detailRestored && customers.length > 0) {
    setDetailRestored(true);
    const detailId = searchParams.get('detail');
    if (detailId) {
      const found = customers.find(c => String(c.id) === String(detailId) || String(c.custid) === String(detailId) || String(c.customer_id) === String(detailId));
      if (found) setSelectedDetailCust(found);
    }
  }

  // Sinkronisasi selectedDetailCust ke URL ?detail=...
  useSearchParamSync(setSearchParams, 'detail', selectedDetailCust?.id ? String(selectedDetailCust.id) : '', '');

  // Pencarian yang diubah dari luar (mis. navigasi dengan ?q=) diterapkan saat render, bukan di effect
  const urlQuery = searchParams.get('q');
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    if (urlQuery !== null && urlQuery !== searchTerm.trim()) setSearchTerm(urlQuery);
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilterDropdown(false);
      }
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) {
        setShowActionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset pagination saat filter/pencarian berubah — diterapkan saat render, bukan di effect (pola
  // sama dengan urlQuery di atas), supaya tidak memicu render berantai (react-hooks/set-state-in-effect).
  const filterKey = `${searchTerm}|${selectedPackage}|${activeTab}|${sortBy}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setCurrentPage(1);
  }

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    updateUrlParam('q', val.trim(), '');
  };

  // Metrics KPI (6 Items: Total, Aktif, Isolir, Lunas, Belum Bayar, E-Billing)
  const stats = useMemo(() => {
    const total = customers.length;
    let sudahBayar = 0;
    let ebilling = 0;
    let aktif = 0;
    let isolir = 0;

    customers.forEach((c) => {
      if (isPaidThisMonth(c, transactions)) sudahBayar++;
      if (c.source === 'E-Billing' || c.pppoe_id || c.pppoeId) ebilling++;
      if (c.status === 'aktif') aktif++;
      else isolir++;
    });

    const belumBayar = total - sudahBayar;
    return { total, sudahBayar, belumBayar, ebilling, aktif, isolir };
  }, [customers, transactions]);

  // Unique package list for filter dropdown
  const packageOptions = useMemo(() => {
    const set = new Set();
    packages.forEach(p => p.name && set.add(p.name));
    customers.forEach(c => c.package && set.add(c.package));
    return Array.from(set).filter(Boolean).sort();
  }, [packages, customers]);

  // Filter & Sort Logic
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return customers.filter((c) => {
      if (term) {
        const pppoe = (c.pppoe_id || c.pppoeId || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const ip = (c.ip_address || c.ipAddress || '').toLowerCase();
        const custid = (c.custid || c.customer_id || c.id || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        const nickname = (c.nickname || '').toLowerCase();
        const address = (c.address || '').toLowerCase();

        const matches = (
          name.includes(term) ||
          nickname.includes(term) ||
          address.includes(term) ||
          pppoe.includes(term) ||
          phone.includes(term) ||
          ip.includes(term) ||
          custid.includes(term)
        );
        if (!matches) return false;
      }

      if (selectedPackage && c.package !== selectedPackage) {
        return false;
      }

      if (activeTab === 'sudah_bayar') return isPaidThisMonth(c, transactions);
      if (activeTab === 'belum_bayar') return !isPaidThisMonth(c, transactions);
      if (activeTab === 'ebilling') return c.source === 'E-Billing' || c.pppoe_id || c.pppoeId;
      if (activeTab === 'aktif') return c.status === 'aktif';
      if (activeTab === 'isolir') return c.status !== 'aktif';
      return true;
    }).sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'due_date') {
        const da = parseInt(a.due_date || a.dueDate || '31', 10) || 31;
        const db = parseInt(b.due_date || b.dueDate || '31', 10) || 31;
        return da - db;
      }
      if (sortBy === 'unpaid_first') {
        const aPaid = isPaidThisMonth(a, transactions) ? 1 : 0;
        const bPaid = isPaidThisMonth(b, transactions) ? 1 : 0;
        return aPaid - bPaid;
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return 0;
    });
  }, [customers, searchTerm, selectedPackage, activeTab, sortBy, transactions]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE) || 1;
  const displayedCustomers = viewMode === 'grid'
    ? filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : filteredCustomers;

  // Transaksi khusus pelanggan yang sedang dibuka detailnya
  const customerTransactions = useMemo(() => {
    if (!selectedDetailCust) return [];
    const custName = (selectedDetailCust.name || '').trim().toLowerCase();
    const pppoe = (selectedDetailCust.pppoe_id || selectedDetailCust.pppoeId || '').trim().toLowerCase();

    return transactions.filter(t => {
      const tName = (t.customerName || t.customer_name || '').trim().toLowerCase();
      const tPppoe = (t.pppoeId || t.pppoe_id || '').trim().toLowerCase();
      return (custName && tName === custName) || (pppoe && tPppoe === pppoe);
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [selectedDetailCust, transactions]);

  const handleSaveEdit = (updatedData) => {
    onUpdateCustomer(updatedData);
    setEditingCustomer(null);
  };

  const handleSync = async () => {
    if (onSyncEbilling) {
      setIsSyncing(true);
      await onSyncEbilling();
      setIsSyncing(false);
      setShowActionDropdown(false);
    }
  };

  const handleQuickPay = (cust) => {
    navigate(`/pos?cust=${cust.id}`);
  };

  const generateWaMessage = (cust, template) => {
    const compName = companyInfo?.name || 'PT Net Synergy Inovate';
    const pkg = cust.package || 'Internet';

    if (template === 'reminder') {
      const today = new Date();
      const dueDay = parseInt(cust.due_date || cust.dueDate || '0', 10);
      const daysLeft = dueDay > 0 ? (dueDay - today.getDate()) : 1;
      return formatDueReminderMessage(cust, daysLeft, companyInfo);
    }
    if (template === 'paid') {
      return `Halo Bapak/Ibu ${cust.name},\n\nTerima kasih! Tagihan internet paket *${pkg}* telah kami terima dengan status *LUNAS*.\n\nSalam hangat,\n*${compName}*`;
    }
    if (template === 'maintenance') {
      return `Halo Bapak/Ibu ${cust.name},\n\nKami menginformasikan saat ini ada pemeliharaan jaringan berkala di area Anda untuk optimasi koneksi.\n\nMohon maaf atas ketidaknyamanannya.\n*${compName}*`;
    }
    return waCustomText;
  };

  const handleSendWa = () => {
    if (!waModalCust || !waModalCust.phone) return;
    const cleanPhone = waModalCust.phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const msg = waTemplateType === 'custom' ? waCustomText : generateWaMessage(waModalCust, waTemplateType);
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setWaModalCust(null);
  };

  const handleSendWaApi = async () => {
    if (!waModalCust || !waModalCust.phone) return;
    setIsSendingWaApi(true);
    try {
      const today = new Date();
      const dueDay = parseInt(waModalCust.due_date || waModalCust.dueDate || '0', 10);
      const daysLeft = dueDay > 0 ? (dueDay - today.getDate()) : 1;
      const res = await fetch('/api/watbiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'send-reminder',
          customer: waModalCust,
          daysLeft,
          companyInfo,
          senderName: session?.profile?.full_name || 'Admin'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        alert(`Pesan WhatsApp berhasil terkirim ke ${waModalCust.name} (${waModalCust.phone})`);
        setWaModalCust(null);
      } else {
        alert(`Pengiriman otomatis gagal (${data.error || 'Watbiz API error'}). Membuka WhatsApp Web...`);
        handleSendWa();
      }
    } catch (err) {
      alert(`Koneksi error: ${err.message}. Membuka WhatsApp Web...`);
      handleSendWa();
    } finally {
      setIsSendingWaApi(false);
    }
  };

  const existingCustids = new Set(customers.map((c) => c.custid).filter(Boolean));
  const hasActiveCustomFilters = activeTab !== 'all' || Boolean(selectedPackage) || sortBy !== 'name_asc';

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3 pb-36 animate-in fade-in duration-200">
      
      {/* 1. Header Toolbar: Title & Dropdown Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">Data Pelanggan</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100">
            {customers.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Action Dropdown Button (Runsnet & E-Billing) */}
          {(role === 'superadmin' || onSyncEbilling) && (
            <div className="relative" ref={actionDropdownRef}>
              <button
                type="button"
                onClick={() => setShowActionDropdown(prev => !prev)}
                className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-1.5 transition-all"
                title="Menu Aksi Lainnya"
              >
                <span>Aksi</span>
                <ChevronDown size={13} className={`text-gray-400 transition-transform ${showActionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showActionDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                  {role === 'superadmin' && (
                    <button
                      onClick={() => {
                        setShowActionDropdown(false);
                        setShowRunsnetPicker(true);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw size={13} className="text-indigo-600" />
                      <span>Import Runsnet</span>
                    </button>
                  )}

                  {onSyncEbilling && (
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isSyncing ? "animate-spin text-emerald-600" : "text-emerald-600"} />
                      <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron E-Billing'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tambah Pelanggan Button */}
          <button
            onClick={() => setShowAddCustomer && setShowAddCustomer(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-200 active:scale-95 transition-all"
          >
            <PlusCircle size={14} />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar (2x3: 2 ke samping, 3 ke bawah di mobile agar nama lengkap nampak jelas) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300/40'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          title="Tampilkan Semua Pelanggan"
        >
          <div className="min-w-0 pr-1">
            <div className={`text-[11px] font-bold leading-tight ${activeTab === 'all' ? 'text-blue-100' : 'text-gray-500'}`}>Total Pelanggan</div>
            <div className="text-base sm:text-lg font-black mt-0.5">{stats.total}</div>
          </div>
          <User size={16} className={`shrink-0 ${activeTab === 'all' ? 'text-white' : 'text-blue-600'}`} />
        </button>

        <button
          onClick={() => setActiveTab('aktif')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
            activeTab === 'aktif'
              ? 'bg-green-600 text-white border-green-600 shadow-xs ring-2 ring-green-300/40'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-green-50/40'
          }`}
          title="Tampilkan Pelanggan Aktif"
        >
          <div className="min-w-0 pr-1">
            <div className={`text-[11px] font-bold leading-tight ${activeTab === 'aktif' ? 'text-green-100' : 'text-green-700'}`}>Pelanggan Aktif</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'aktif' ? 'text-white' : 'text-green-700'}`}>{stats.aktif}</div>
          </div>
          <CheckCircle2 size={16} className={`shrink-0 ${activeTab === 'aktif' ? 'text-white' : 'text-green-600'}`} />
        </button>

        <button
          onClick={() => setActiveTab('sudah_bayar')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
            activeTab === 'sudah_bayar'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300/40'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-emerald-50/40'
          }`}
          title="Tampilkan yang Sudah Lunas Bulan Ini"
        >
          <div className="min-w-0 pr-1">
            <div className={`text-[11px] font-bold leading-tight ${activeTab === 'sudah_bayar' ? 'text-emerald-100' : 'text-emerald-700'}`}>Lunas Bulan Ini</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'sudah_bayar' ? 'text-white' : 'text-emerald-600'}`}>{stats.sudahBayar}</div>
          </div>
          <CheckCircle2 size={16} className={`shrink-0 ${activeTab === 'sudah_bayar' ? 'text-white' : 'text-emerald-600'}`} />
        </button>

        <button
          onClick={() => setActiveTab('belum_bayar')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
            activeTab === 'belum_bayar'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300/40'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50/40'
          }`}
          title="Tampilkan yang Belum Bayar Bulan Ini"
        >
          <div className="min-w-0 pr-1">
            <div className={`text-[11px] font-bold leading-tight ${activeTab === 'belum_bayar' ? 'text-amber-100' : 'text-amber-700'}`}>Belum Bayar</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'belum_bayar' ? 'text-white' : 'text-amber-600'}`}>{stats.belumBayar}</div>
          </div>
          <Clock size={16} className={`shrink-0 ${activeTab === 'belum_bayar' ? 'text-white' : 'text-amber-600'}`} />
        </button>

        <button
          onClick={() => setActiveTab('ebilling')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
            activeTab === 'ebilling'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300/40'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50/40'
          }`}
          title="Tampilkan Pelanggan E-Billing Runsnet"
        >
          <div className="min-w-0 pr-1">
            <div className={`text-[11px] font-bold leading-tight ${activeTab === 'ebilling' ? 'text-indigo-100' : 'text-indigo-700'}`}>E-Billing / Runsnet</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'ebilling' ? 'text-white' : 'text-indigo-700'}`}>{stats.ebilling}</div>
          </div>
          <ShieldCheck size={16} className={`shrink-0 ${activeTab === 'ebilling' ? 'text-white' : 'text-indigo-600'}`} />
        </button>

        <button
          onClick={() => setActiveTab('isolir')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
            activeTab === 'isolir'
              ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-300/40'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-red-50/40'
          }`}
          title="Tampilkan Pelanggan Isolir"
        >
          <div className="min-w-0 pr-1">
            <div className={`text-[11px] font-bold leading-tight ${activeTab === 'isolir' ? 'text-red-100' : 'text-red-700'}`}>Pelanggan Isolir</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'isolir' ? 'text-white' : 'text-red-700'}`}>{stats.isolir}</div>
          </div>
          <AlertCircle size={16} className={`shrink-0 ${activeTab === 'isolir' ? 'text-white' : 'text-red-600'}`} />
        </button>
      </div>

      {/* 3. Search Bar + Dropdown Filter & Urutan + View Switcher (1 Row, No Stack!) */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 focus-within:border-blue-500 shadow-xs transition-all">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cari Nama, ID PPPoE, No. WA, IP, Alamat..."
            className="w-full bg-transparent border-none outline-none px-2 text-xs text-gray-800 placeholder-gray-400"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearchChange('')}
              className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Filter & Urutan Button */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            type="button"
            onClick={() => setShowFilterDropdown(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all ${
              hasActiveCustomFilters
                ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-300'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter size={13} className={hasActiveCustomFilters ? 'text-blue-600' : 'text-gray-400'} />
            <span className="hidden sm:inline">Filter & Urutkan</span>
            <span className="sm:hidden">Filter</span>
            {hasActiveCustomFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            )}
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Floating Filter Popover */}
          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-200 p-3.5 z-30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              {/* Filter Status */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Filter Status</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'aktif', label: 'Aktif' },
                    { id: 'isolir', label: 'Isolir' },
                    { id: 'sudah_bayar', label: 'Lunas' },
                    { id: 'belum_bayar', label: 'Belum Bayar' },
                    { id: 'ebilling', label: 'E-Billing' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold text-center transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Paket */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Paket Internet</label>
                <select
                  value={selectedPackage}
                  onChange={(e) => setSelectedPackage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-700 outline-none"
                >
                  <option value="">Semua Paket ({packageOptions.length})</option>
                  {packageOptions.map(pkg => (
                    <option key={pkg} value={pkg}>{pkg}</option>
                  ))}
                </select>
              </div>

              {/* Urutan / Sort */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Urutan Daftar</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-700 outline-none"
                >
                  <option value="name_asc">Nama (A - Z)</option>
                  <option value="name_desc">Nama (Z - A)</option>
                  <option value="due_date">Tgl Tagihan (1 - 31)</option>
                  <option value="unpaid_first">Belum Bayar Duluan</option>
                  <option value="newest">Terbaru Ditambahkan</option>
                </select>
              </div>

              {/* Reset Filter Button */}
              {hasActiveCustomFilters && (
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('all');
                      setSelectedPackage('');
                      setSortBy('name_asc');
                      setShowFilterDropdown(false);
                    }}
                    className="text-[11px] font-bold text-red-600 hover:underline"
                  >
                    Reset Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilterDropdown(false)}
                    className="bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-lg"
                  >
                    Terapkan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-white p-0.5 rounded-xl border border-gray-200 shadow-xs shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400 hover:text-gray-700'}`}
            title="Tampilan Grid Kartu"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400 hover:text-gray-700'}`}
            title="Tampilan Tabel/Daftar"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* 4. Customer Listing (2 Kolom di Mobile, 6 Kolom di Desktop, Ukuran Pas Seperti Tadi!) */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center space-y-2">
          <p className="text-xs font-bold text-gray-600">Pelanggan tidak ditemukan...</p>
          {(searchTerm || hasActiveCustomFilters) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSearchParams({}, { replace: true });
                setActiveTab('all');
                setSelectedPackage('');
              }}
              className="text-[11px] font-bold text-blue-600 hover:underline"
            >
              Reset Pencarian & Filter
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: Pure 2-Column Grid (6 items per page with sleek pagination) */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {displayedCustomers.map((cust) => {
              const displayName = cust.name || cust.customer_name || cust.customerName || cust.nama || 'Pelanggan';
              const pppoe = cust.pppoe_id || cust.pppoeId;
              const isEbilling = cust.source === 'E-Billing' || pppoe;
              const paidMonth = isPaidThisMonth(cust, transactions);
              const visitStatus = visitStatusById[cust.id];

              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedDetailCust(cust)}
                  className={`bg-white p-2.5 sm:p-3 rounded-xl border shadow-xs relative flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer ${
                    cust.status !== 'aktif' ? 'border-red-100 bg-red-50/20' : 'border-gray-200'
                  }`}
                  title={`Klik untuk lihat rincian lengkap ${displayName}`}
                >
                  <div>
                    {/* Top Bar: Avatar with status dot, Name, Detail & Edit Actions */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr ${getAvatarColor(displayName)} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                            {getInitials(displayName)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            title={cust.status}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="font-bold text-gray-900 text-xs sm:text-sm leading-snug break-words"
                            title={displayName}
                          >
                            {displayName}
                          </h3>
                          {cust.nickname && (
                            <p className="text-gray-400 font-medium text-[10px] mt-0.5 truncate">
                              ({cust.nickname})
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailCust(cust);
                          }}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Lihat Detail Profil & Teknis"
                        >
                          <Info size={13} />
                        </button>
                        {role === 'superadmin' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCustomer(cust);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Hapus pelanggan "${displayName}"?`)) onDeleteCustomer(cust.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Visit Status if any */}
                    {visitStatus && (
                      <div className="mt-1.5">
                        <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${TONE_BADGE_CLASSES[visitStatus.tone]}`}>
                          {visitStatus.label}
                        </span>
                      </div>
                    )}

                    {/* Status Pills: PPPoE, E-Billing, Lunas/Belum Bayar */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {pppoe && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-100 max-w-[100px] truncate">
                          <Key size={8} className="text-blue-500 shrink-0" />
                          <span className="truncate">{pppoe}</span>
                        </span>
                      )}

                      {isEbilling && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <CheckCircle2 size={8} /> Runsnet
                        </span>
                      )}

                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        paidMonth ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {paidMonth ? <CheckCircle2 size={8} /> : <Clock size={8} />}
                        {paidMonth ? 'Lunas Bulan Ini' : 'Belum Bayar'}
                      </span>
                    </div>

                    {/* Customer Information Lines */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 flex items-center gap-1"><Wifi size={10} /> Paket</span>
                        <span className="font-bold text-gray-700 truncate max-w-[90px]" title={cust.package}>
                          {cust.package || 'Net Home'}
                        </span>
                      </div>

                      {cust.price && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Tagihan</span>
                          <span className="font-black text-emerald-600">{formatRupiah(cust.price)}</span>
                        </div>
                      )}

                      {cust.phone && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center gap-1"><Phone size={10} /> WA</span>
                          <a
                            href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-green-600 hover:underline flex items-center gap-0.5"
                          >
                            {cust.phone} <ExternalLink size={8} />
                          </a>
                        </div>
                      )}

                      {cust.ip_address && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 flex items-center gap-1"><Network size={10} /> IP</span>
                          <span className="font-mono font-bold text-gray-700">{cust.ip_address}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 flex items-center gap-1"><Calendar size={10} /> Tgl Bayar</span>
                        <span className={`font-bold ${cust.status === 'aktif' ? 'text-gray-700' : 'text-red-600'}`}>
                          {cust.due_date || cust.dueDate || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Compact Action Buttons */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickPay(cust);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
                    >
                      <CreditCard size={11} />
                      <span>{paidMonth ? 'Bayar +' : 'Bayar'}</span>
                    </button>

                    {cust.phone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWaModalCust(cust);
                          setWaTemplateType(paidMonth ? 'paid' : 'reminder');
                        }}
                        className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg active:scale-95 transition-all"
                        title="Kirim pesan WhatsApp / Tagihan"
                      >
                        <MessageSquare size={12} />
                      </button>
                    )}

                    {cust.lat && cust.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${cust.lat},${cust.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg active:scale-95 transition-all"
                        title="Buka Navigasi Maps"
                      >
                        <MapPin size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sleek Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-xs">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ‹ Sebelumnya
              </button>
              <span className="font-medium text-gray-500 text-[11px] sm:text-xs">
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Selanjutnya ›
              </button>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW: Clean Mobile-First Table (Klik baris mana saja untuk buka detail) */
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/90 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Pelanggan & Paket</th>
                <th className="py-2.5 px-2.5">Tagihan & Status</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map((cust) => {
                const displayName = cust.name || cust.customer_name || cust.customerName || cust.nama || 'Pelanggan';
                const pppoe = cust.pppoe_id || cust.pppoeId;
                const paidMonth = isPaidThisMonth(cust, transactions);
                const visitStatus = visitStatusById[cust.id];

                return (
                  <tr
                    key={cust.id}
                    onClick={() => setSelectedDetailCust(cust)}
                    className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                      cust.status !== 'aktif' ? 'bg-red-50/15' : ''
                    }`}
                    title={`Klik untuk lihat rincian lengkap ${displayName}`}
                  >
                    {/* Column 1: Pelanggan & Paket */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-start gap-2 sm:gap-2.5 min-w-0">
                        <div className="relative shrink-0 mt-0.5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${getAvatarColor(displayName)} text-white font-extrabold flex items-center justify-center text-xs shadow-xs`}>
                            {getInitials(displayName)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                              cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            title={cust.status}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-gray-900 text-xs leading-tight truncate" title={displayName}>
                            {displayName}
                          </div>
                          {cust.nickname && (
                            <div className="text-[10px] text-gray-400 font-medium truncate">
                              ({cust.nickname})
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-600 font-medium">
                              <Wifi size={10} className="text-blue-500 shrink-0" />
                              <span className="truncate max-w-[90px] sm:max-w-[130px]">{cust.package || 'Net Home'}</span>
                            </span>
                            {pppoe && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100 truncate max-w-[85px] sm:max-w-[110px]" title={pppoe}>
                                <Key size={8} className="text-blue-500 shrink-0" />
                                <span className="truncate">{pppoe}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Tagihan & Status */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-600 text-xs">
                          {cust.price ? formatRupiah(cust.price) : '-'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              paidMonth
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}
                          >
                            {paidMonth ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                            <span>{paidMonth ? 'Lunas Bulan Ini' : 'Belum Bayar'}</span>
                          </span>
                          {visitStatus && (
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${TONE_BADGE_CLASSES[visitStatus.tone]}`}>
                              {visitStatus.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Tgl {cust.due_date || cust.dueDate || '-'}
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Aksi */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickPay(cust);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1 px-2 rounded-lg shadow-xs active:scale-95 transition-all inline-flex items-center gap-1"
                          title="Bayar di Kasir"
                        >
                          <CreditCard size={11} />
                          <span>Bayar</span>
                        </button>

                        {cust.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWaModalCust(cust);
                              setWaTemplateType(paidMonth ? 'paid' : 'reminder');
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg active:scale-95 transition-all"
                            title="Kirim pesan WhatsApp / Tagihan"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailCust(cust);
                          }}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg active:scale-95 transition-all"
                          title="Lihat Detail Profil & Teknis"
                        >
                          <Info size={14} />
                        </button>

                        {role === 'superadmin' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCustomer(cust);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg active:scale-95 transition-all"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Hapus pelanggan "${displayName}"?`)) onDeleteCustomer(cust.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg active:scale-95 transition-all"
                              title="Hapus"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Detail Modal Pelanggan (Kecil, Rapi & Ringkas) */}
      {selectedDetailCust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 animate-backdrop">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-sheet-up sm:animate-pop-in flex flex-col max-h-[90vh]">
            
            {/* Modal Header: Ringkas & Bersih */}
            <div className="bg-blue-600 px-4 py-3 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} />
                <div>
                  <h3 className="font-bold text-sm leading-tight">{selectedDetailCust.name}</h3>
                  <p className="text-[10px] text-blue-100">ID: {selectedDetailCust.id} • Status: {selectedDetailCust.status?.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailCust(null)}
                className="p-1 hover:bg-white/20 rounded-lg text-white"
                title="Tutup Modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50 px-3 pt-1.5 gap-1 shrink-0">
              <button
                onClick={() => setDetailModalTab('tech')}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all ${
                  detailModalTab === 'tech'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Layanan & Teknis
              </button>
              <button
                onClick={() => setDetailModalTab('history')}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all ${
                  detailModalTab === 'history'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Riwayat Tagihan ({customerTransactions.length})
              </button>
              <button
                onClick={() => setDetailModalTab('location')}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all ${
                  detailModalTab === 'location'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Lokasi & Peta
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              {detailModalTab === 'tech' && (
                <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500">ID PPPoE:</span>
                    <span className="font-mono font-bold text-blue-900">{selectedDetailCust.pppoe_id || selectedDetailCust.pppoeId || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500">CustID / E-Billing:</span>
                    <span className="font-mono font-bold text-gray-800">{selectedDetailCust.custid || selectedDetailCust.customer_id || selectedDetailCust.id || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500">Paket:</span>
                    <span className="font-bold text-gray-900">{selectedDetailCust.package || '-'}</span>
                  </div>
                  {selectedDetailCust.price && (
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Tagihan:</span>
                      <span className="font-black text-emerald-600">{formatRupiah(selectedDetailCust.price)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500">Tgl Jatuh Tempo:</span>
                    <span className="font-bold text-gray-800">Tgl {selectedDetailCust.due_date || selectedDetailCust.dueDate || '-'}</span>
                  </div>
                  {selectedDetailCust.ip_address && (
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">IP PPPoE:</span>
                      <span className="font-mono font-bold text-gray-800">{selectedDetailCust.ip_address}</span>
                    </div>
                  )}
                  {selectedDetailCust.mac_address && (
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">MAC Address:</span>
                      <span className="font-mono font-bold text-gray-800">{selectedDetailCust.mac_address}</span>
                    </div>
                  )}
                  {selectedDetailCust.serial_number && (
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">SN ONU:</span>
                      <span className="font-mono font-bold text-gray-800">{selectedDetailCust.serial_number}</span>
                    </div>
                  )}
                  {selectedDetailCust.phone && (
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">No. WA / HP:</span>
                      <span className="font-bold text-green-700">{selectedDetailCust.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Alamat:</span>
                    <span className="font-medium text-gray-800 text-right max-w-[200px]">{selectedDetailCust.address || '-'}</span>
                  </div>
                </div>
              )}

              {detailModalTab === 'history' && (
                <div className="space-y-2">
                  {customerTransactions.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 italic">Belum ada riwayat transaksi tercatat.</div>
                  ) : (
                    customerTransactions.map(trx => (
                      <div key={trx.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-gray-700">{trx.invoiceNumber ? `#${trx.invoiceNumber}` : `#${trx.id}`}</span>
                          <span className="font-bold text-emerald-600">{formatRupiah(trx.amountPaid || trx.amount_paid || trx.price)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>{trx.date ? new Date(trx.date).toLocaleDateString('id-ID') : '-'} • Kasir: {trx.cashierName || 'Admin'}</span>
                          {setReceiptToView && (
                            <button
                              onClick={() => {
                                setSelectedDetailCust(null);
                                setReceiptToView(trx);
                              }}
                              className="text-blue-600 font-bold hover:underline"
                            >
                              Struk
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailModalTab === 'location' && (
                <div className="space-y-2.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Koordinat GPS</span>
                      <p className="font-mono font-bold text-xs mt-0.5">
                        {selectedDetailCust.lat && selectedDetailCust.lng
                          ? `${Number(selectedDetailCust.lat).toFixed(5)}, ${Number(selectedDetailCust.lng).toFixed(5)}`
                          : 'Belum ada GPS'}
                      </p>
                    </div>
                    {selectedDetailCust.lat && selectedDetailCust.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedDetailCust.lat},${selectedDetailCust.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1"
                      >
                        <Navigation size={11} /> Maps
                      </a>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-600 pt-1 border-t border-gray-200">
                    <span className="font-bold text-gray-500">Alamat:</span> {selectedDetailCust.address || '-'}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const c = selectedDetailCust;
                  setSelectedDetailCust(null);
                  handleQuickPay(c);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs"
              >
                Bayar di Kasir
              </button>

              <button
                onClick={() => setSelectedDetailCust(null)}
                className="bg-gray-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. WhatsApp Message Template Modal */}
      {waModalCust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 animate-backdrop">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-sheet-up sm:animate-pop-in flex flex-col max-h-[85vh]">
            <div className="bg-emerald-600 px-4 py-3 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} />
                <h3 className="font-bold text-xs sm:text-sm">Kirim Pesan WhatsApp</h3>
              </div>
              <button onClick={() => setWaModalCust(null)} className="p-1 hover:bg-white/20 rounded-lg text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto text-xs">
              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs">{waModalCust.name}</h4>
                  <p className="text-[10px] text-emerald-700">{waModalCust.phone}</p>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white text-emerald-800 rounded border border-emerald-200">
                  {waModalCust.package || 'Internet'}
                </span>
              </div>

              {/* Template Choices */}
              <div className="space-y-1">
                <label className="font-bold text-gray-600 text-[10px] uppercase">Pilih Template:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWaTemplateType('reminder')}
                    className={`p-2 rounded-xl border text-left text-[11px] font-bold transition-all ${
                      waTemplateType === 'reminder'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    Pengingat Tagihan
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaTemplateType('paid')}
                    className={`p-2 rounded-xl border text-left text-[11px] font-bold transition-all ${
                      waTemplateType === 'paid'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    Konfirmasi Lunas
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-1">
                <label className="font-bold text-gray-600 text-[10px] uppercase">Isi Pesan:</label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-[11px] text-gray-800 whitespace-pre-wrap max-h-36 overflow-y-auto font-sans leading-relaxed">
                  {generateWaMessage(waModalCust, waTemplateType)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setWaModalCust(null)}
                className="bg-white text-gray-700 border border-gray-200 font-bold text-xs px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSendWa}
                className="bg-white text-emerald-700 border border-emerald-300 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-emerald-50 transition-colors"
                title="Buka aplikasi WhatsApp atau Web untuk kirim pesan manual"
              >
                <MessageSquare size={12} />
                <span>Kirim ke WhatsApp</span>
              </button>
              {companyInfo?.watbizEnabled && companyInfo?.watbizToken && (
                <button
                  type="button"
                  onClick={handleSendWaApi}
                  disabled={isSendingWaApi}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm disabled:opacity-50 transition-all active:scale-95"
                  title="Kirim pesan langsung via Watbiz API bot tanpa buka aplikasi WhatsApp"
                >
                  <Send size={12} className={isSendingWaApi ? 'animate-spin' : ''} />
                  <span>{isSendingWaApi ? 'Mengirim...' : 'Kirim via Watbiz'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Superadmin Modals: Edit Customer & Runsnet Picker */}
      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          packages={packages}
          onClose={() => setEditingCustomer(null)}
          onSave={handleSaveEdit}
        />
      )}

      {showRunsnetPicker && (
        <RunsnetCustomerPicker
          session={session}
          existingCustids={existingCustids}
          onClose={() => setShowRunsnetPicker(false)}
          onImported={onRunsnetImported}
        />
      )}
    </div>
  );
};

export default Pelanggan;
