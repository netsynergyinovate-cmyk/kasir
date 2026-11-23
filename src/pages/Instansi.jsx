import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSearchParamSync } from '../hooks/useSearchParamSync';
import {
  Building2, FileText, Receipt, Layers, Plus, Trash2, Pencil, Eye, Search, X,
  Wallet, ListChecks, AlertCircle, TrendingUp, Home, Wifi, CalendarClock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import InstansiClientForm from '../components/InstansiClientForm';
import InstansiInvoiceForm from '../components/InstansiInvoiceForm';
import InstansiMultipate from '../components/InstansiMultipate';
import InstansiPreviewModal from '../components/InstansiPreviewModal';
import {
  formatDateIndo, formatDateIndoShort, formatNumber, amountInWords, summarizeInvoices, filterInvoices, filterClients,
} from '../utils/instansiInvoice';
import { hasPermission } from '../utils/permissions';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const mapProfile = (row) => ({
  companyName: row?.name || '',
  address: row?.address || '',
  logoUrl: row?.logo_url || '',
  companyId: row?.invoice_company_id || '',
  csName: row?.invoice_cs_name || '',
  csEmail: row?.invoice_cs_email || '',
  csPhone: row?.invoice_cs_phone || '',
  bankName: row?.invoice_bank_name || '',
  bankAccount: row?.invoice_bank_account || '',
  bankHolder: row?.invoice_bank_holder || '',
});

const isOverdue = (inv) => inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date(new Date().toDateString());

const StatCard = ({ icon: Icon, label, value, tone, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 min-w-[128px] text-left p-3 rounded-2xl border transition-all ${active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-900'} ${onClick ? 'active:scale-95' : ''}`}
  >
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${active ? 'bg-white/15' : tone}`}>
      <Icon size={14} className={active ? 'text-white' : ''} />
    </div>
    <p className={`text-[9px] font-bold uppercase tracking-widest ${active ? 'text-white/60' : 'text-gray-400'}`}>{label}</p>
    <p className="text-sm font-black leading-tight mt-0.5">{value}</p>
  </button>
);

const TAB_TITLES = { clients: 'Klien Instansi', invoices: 'Invoice', faktur: 'Faktur', multipate: 'Terbit Massal' };

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const HeroStat = ({ label, value, danger }) => (
  <div className="bg-white/10 rounded-2xl px-3 py-2.5">
    <p className={`text-lg font-black leading-none ${danger && value > 0 ? 'text-red-300' : ''}`}>{value}</p>
    <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mt-1">{label}</p>
  </div>
);

const SectionHead = ({ title, count, actionLabel, onAction, disabled }) => (
  <div className="flex items-center justify-between pt-1">
    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
      {title} <span className="text-gray-300">· {count}</span>
    </p>
    <button type="button" onClick={onAction} disabled={disabled} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-900 text-white text-[10px] font-black uppercase tracking-wide disabled:opacity-40 active:scale-95 transition-all">
      <Plus size={12} /> {actionLabel}
    </button>
  </div>
);

const EmptyState = ({ icon: Icon, text }) => (
  <div className="flex flex-col items-center text-center py-12 text-gray-400">
    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3"><Icon size={24} /></div>
    <p className="text-xs">{text}</p>
  </div>
);

// Item bottom nav khusus Instansi: tombol (bukan link) karena berpindah tab di dalam halaman ini.
const NavTab = ({ icon: Icon, label, active, onClick, badge }) => (
  <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className="relative flex flex-col items-center gap-1 w-14 tap-bounce group">
    <span className={`flex items-center justify-center w-9 h-8 rounded-xl transition-all duration-200 ${active ? 'bg-gray-900 text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
      <Icon size={17} strokeWidth={active ? 2.5 : 2} />
    </span>
    <span className={`text-[9px] transition-all duration-200 ${active ? 'text-gray-900 font-bold' : 'text-slate-400'}`}>{label}</span>
    {badge > 0 && (
      <span className="absolute -top-1 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center border-2 border-white">{badge}</span>
    )}
  </button>
);

const Instansi = ({ session }) => {
  const navigate = useNavigate();
  const canDelete = hasPermission(session?.profile?.role, 'instansi.delete', session?.profile?.allowed_paths);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    return searchParams.get('tab') || localStorage.getItem('kasir_instansi_tab') || 'clients';
  });

  useSearchParamSync(setSearchParams, 'tab', tab, 'clients', 'kasir_instansi_tab');
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState(mapProfile(null));
  const [internetPackages, setInternetPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingClient, setEditingClient] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showMultipate, setShowMultipate] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('all');

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState('');
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState('');
  const [invoiceYearFilter, setInvoiceYearFilter] = useState('');

  const fetchAll = () => Promise.all([
    supabase.from('instansi_clients').select('*').order('institution_name'),
    supabase.from('instansi_invoices').select('*, client:instansi_clients(*)').order('created_at', { ascending: false }),
    supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  const applyAll = ([clientsRes, invoicesRes, settingsRes]) => {
    if (clientsRes.data) setClients(clientsRes.data);
    if (invoicesRes.data) setInvoices(invoicesRes.data);
    if (settingsRes.data) {
      setProfile(mapProfile(settingsRes.data));
      setInternetPackages(Array.isArray(settingsRes.data.invoice_internet_packages) ? settingsRes.data.invoice_internet_packages : []);
    }
    setLoading(false);
  };

  const loadAll = async () => applyAll(await fetchAll());

  useEffect(() => {
    fetchAll().then(applyAll);
  }, []);

  const existingInvoiceNumbers = useMemo(() => invoices.map((i) => i.invoice_number), [invoices]);

  const allStats = useMemo(() => summarizeInvoices(invoices), [invoices]);
  const overdueCount = useMemo(() => invoices.filter(isOverdue).length, [invoices]);
  const pendingOf = (kind) => invoices.filter((i) => i.kind === kind && i.status !== 'paid').length;

  const handleSaveClient = async (form) => {
    const payload = {
      client_code: form.clientCode,
      institution_name: form.institutionName,
      email: form.email || null,
      service_package: form.servicePackage || null,
      address: form.address || null,
      status: form.status,
    };
    const query = editingClient
      ? supabase.from('instansi_clients').update(payload).eq('id', editingClient.id)
      : supabase.from('instansi_clients').insert(payload);
    const { error } = await query;
    if (error) throw error;
    setShowClientForm(false);
    setEditingClient(null);
    loadAll();
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Hapus klien "${client.institution_name}"? Invoice yang sudah terbit tidak ikut terhapus.`)) return;
    const { error } = await supabase.from('instansi_clients').delete().eq('id', client.id);
    if (error) alert('Gagal menghapus: ' + error.message);
    else loadAll();
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!window.confirm(`Hapus ${invoice.invoice_number}?`)) return;
    const { error } = await supabase.from('instansi_invoices').delete().eq('id', invoice.id);
    if (error) alert('Gagal menghapus: ' + error.message);
    else loadAll();
  };

  const openPreview = (invoice) => {
    const client = invoice.client;
    setPreviewItem({
      invoiceData: {
        institutionName: client?.institution_name,
        clientId: client?.client_code,
        servicePackage: client?.service_package || 'NSI Standard',
        email: client?.email,
        address: client?.address,
        invoiceNumber: invoice.invoice_number,
        issuedDate: invoice.issued_date,
        dueDate: invoice.due_date,
        method: invoice.method,
        status: invoice.status === 'paid' ? 'LUNAS' : 'PENDING',
        issuancePlace: invoice.issuance_place,
        issuanceDate: invoice.issuance_date ? formatDateIndo(invoice.issuance_date) : '',
        amountInWords: amountInWords(Number(invoice.amount)),
      },
      lineItems: [
        { type: 'Layanan', description: `NETWORK ${client?.service_package || 'STANDARD'}`, price: Number(invoice.amount) },
        { type: 'Bulan', description: `${MONTHS[new Date(invoice.issued_date).getMonth()]} (1 BULAN)`, price: 0 },
      ],
      subtotal: Number(invoice.amount),
    });
  };

  const invoicesForKind = useMemo(() => invoices.filter((i) => i.kind === (tab === 'faktur' ? 'faktur' : 'invoice')), [invoices, tab]);
  const stats = useMemo(() => summarizeInvoices(invoicesForKind), [invoicesForKind]);
  const visibleInvoices = useMemo(() => filterInvoices(invoicesForKind, {
    status: invoiceStatusFilter,
    clientId: invoiceClientFilter ? Number(invoiceClientFilter) : null,
    month: invoiceMonthFilter ? Number(invoiceMonthFilter) : null,
    year: invoiceYearFilter ? Number(invoiceYearFilter) : null,
    search: invoiceSearch,
  }), [invoicesForKind, invoiceStatusFilter, invoiceClientFilter, invoiceMonthFilter, invoiceYearFilter, invoiceSearch]);

  const clientStats = useMemo(() => ({
    total: clients.length,
    active: clients.filter((c) => c.status === 'active').length,
    inactive: clients.filter((c) => c.status !== 'active').length,
  }), [clients]);
  const visibleClients = useMemo(() => filterClients(clients, { status: clientStatusFilter, search: clientSearch }), [clients, clientStatusFilter, clientSearch]);

  const hasInvoiceFilters = invoiceStatusFilter !== 'all' || invoiceClientFilter || invoiceMonthFilter || invoiceYearFilter || invoiceSearch;
  const clearInvoiceFilters = () => {
    setInvoiceStatusFilter('all'); setInvoiceClientFilter(''); setInvoiceMonthFilter(''); setInvoiceYearFilter(''); setInvoiceSearch('');
  };

  const yearOptions = useMemo(() => {
    const years = new Set(invoicesForKind.map((i) => new Date(i.issued_date).getFullYear()));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [invoicesForKind]);

  const openNewClient = () => { setEditingClient(null); setShowClientForm(true); };
  // Belum ada klien -> FAB membuka form klien dulu, karena invoice/faktur/massal butuh klien.
  const withClient = (open) => () => (clients.length ? open() : openNewClient());
  const fab = {
    invoices: { label: 'Terbitkan Invoice', run: withClient(() => setShowInvoiceForm(true)) },
    faktur: { label: 'Terbitkan Faktur', run: withClient(() => setShowInvoiceForm(true)) },
    multipate: { label: 'Buka Generator Massal', run: withClient(() => setShowMultipate(true)) },
  }[tab] || { label: 'Tambah Klien', run: openNewClient };
  const docLabel = tab === 'faktur' ? 'Faktur' : 'Invoice';

  return (
    <div className="p-4 pb-32 animate-in fade-in duration-300">
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-3xl p-5 text-white mb-5 shadow-lg">
        <Building2 size={140} className="absolute -right-8 -bottom-10 text-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0"><Building2 size={20} /></div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Invoice Instansi · B2B</p>
            <h2 className="text-lg font-black leading-tight truncate">{TAB_TITLES[tab] || TAB_TITLES.clients}</h2>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2 mt-4">
          <HeroStat label="Klien Aktif" value={clientStats.active} />
          <HeroStat label="Belum Lunas" value={allStats.pending} />
          <HeroStat label="Jatuh Tempo" value={overdueCount} danger />
        </div>
        <p className="relative text-[11px] text-white/60 mt-3">
          Tagihan berjalan <span className="font-black text-white">Rp {formatNumber(allStats.pendingAmount)}</span>
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : tab === 'multipate' ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><Layers size={26} /></div>
          <p className="font-black text-gray-900">Terbit Massal</p>
          <p className="text-xs text-gray-500 mt-1">Terbitkan invoice atau faktur untuk banyak klien sekaligus dalam satu proses.</p>
          <p className="text-[11px] font-bold text-gray-400 mt-3">{clientStats.active} klien aktif siap diproses</p>
          <button type="button" onClick={() => setShowMultipate(true)} disabled={clients.length === 0} className="mt-4 w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Layers size={16} /> Buka Generator Massal
          </button>
          {clients.length === 0 && <p className="text-xs text-gray-400 italic mt-3">Tambah klien dulu di menu Klien.</p>}
        </div>
      ) : tab === 'clients' ? (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <StatCard icon={Building2} label="Total Klien" value={clientStats.total} tone="bg-gray-100" active={clientStatusFilter === 'all'} onClick={() => setClientStatusFilter('all')} />
            <StatCard icon={ListChecks} label="Aktif" value={clientStats.active} tone="bg-emerald-50 text-emerald-600" active={clientStatusFilter === 'active'} onClick={() => setClientStatusFilter('active')} />
            <StatCard icon={AlertCircle} label="Nonaktif" value={clientStats.inactive} tone="bg-gray-100 text-gray-400" active={clientStatusFilter === 'inactive'} onClick={() => setClientStatusFilter('inactive')} />
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} type="text" placeholder="Cari nama instansi / kode klien..." className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs focus:border-gray-900 transition-colors" />
          </div>

          <SectionHead title="Daftar Klien" count={visibleClients.length} actionLabel="Klien" onAction={openNewClient} />

          {visibleClients.length === 0 ? (
            <EmptyState icon={Building2} text={clients.length === 0 ? 'Belum ada klien instansi.' : 'Tidak ada klien yang cocok.'} />
          ) : visibleClients.map((c) => {
            const active = c.status === 'active';
            return (
              <div key={c.id} className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-xs ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {initialsOf(c.institution_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-gray-900 text-[13px] uppercase truncate">{c.institution_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] text-gray-400">{c.client_code}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{active ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 truncate flex items-center gap-1"><Wifi size={11} className="shrink-0" /> {c.service_package || '-'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" aria-label="Ubah klien" onClick={() => { setEditingClient(c); setShowClientForm(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Pencil size={14} /></button>
                  {canDelete && <button type="button" aria-label="Hapus klien" onClick={() => handleDeleteClient(c)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <StatCard icon={FileText} label="Total" value={stats.total} tone="bg-gray-100" active={invoiceStatusFilter === 'all'} onClick={() => setInvoiceStatusFilter('all')} />
            <StatCard icon={TrendingUp} label="Lunas" value={`Rp ${formatNumber(stats.paidAmount)}`} tone="bg-emerald-50 text-emerald-600" active={invoiceStatusFilter === 'paid'} onClick={() => setInvoiceStatusFilter('paid')} />
            <StatCard icon={Wallet} label="Pending" value={`Rp ${formatNumber(stats.pendingAmount)}`} tone="bg-amber-50 text-amber-600" active={invoiceStatusFilter === 'pending'} onClick={() => setInvoiceStatusFilter('pending')} />
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} type="text" placeholder="Cari nomor dokumen / nama instansi..." className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs focus:border-gray-900 transition-colors" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <select value={invoiceClientFilter} onChange={(e) => setInvoiceClientFilter(e.target.value)} className="shrink-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600">
              <option value="">Semua Klien</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.institution_name}</option>)}
            </select>
            <select value={invoiceMonthFilter} onChange={(e) => setInvoiceMonthFilter(e.target.value)} className="shrink-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600">
              <option value="">Semua Bulan</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={invoiceYearFilter} onChange={(e) => setInvoiceYearFilter(e.target.value)} className="shrink-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600">
              <option value="">Semua Tahun</option>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {hasInvoiceFilters && (
              <button type="button" onClick={clearInvoiceFilters} className="shrink-0 flex items-center gap-1 px-3 py-2.5 bg-red-50 text-red-500 rounded-xl text-xs font-bold">
                <X size={13} /> Reset
              </button>
            )}
          </div>

          <SectionHead title={`Daftar ${docLabel}`} count={visibleInvoices.length} actionLabel={docLabel} onAction={() => setShowInvoiceForm(true)} disabled={clients.length === 0} />

          {visibleInvoices.length === 0 ? (
            <EmptyState icon={tab === 'faktur' ? Receipt : FileText} text={invoicesForKind.length === 0 ? `Belum ada ${docLabel.toLowerCase()}.` : 'Tidak ada dokumen yang cocok dengan filter.'} />
          ) : visibleInvoices.map((inv) => {
            const overdue = isOverdue(inv);
            const tone = inv.status === 'paid' ? 'paid' : overdue ? 'overdue' : 'pending';
            const badgeClass = { paid: 'bg-emerald-50 text-emerald-600', overdue: 'bg-red-50 text-red-600', pending: 'bg-amber-50 text-amber-600' }[tone];
            const stripeClass = { paid: 'bg-emerald-500', overdue: 'bg-red-500', pending: 'bg-amber-400' }[tone];
            return (
              <div key={inv.id} className="relative bg-white pl-5 pr-3.5 py-3.5 rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex items-center gap-3">
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripeClass}`} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openPreview(inv)}>
                  <p className="font-black text-gray-900 text-[13px] uppercase truncate">{inv.client?.institution_name || 'Klien terhapus'}</p>
                  <p className="font-mono text-[10px] text-gray-400 truncate">{inv.invoice_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-black text-gray-900">Rp {formatNumber(inv.amount)}</p>
                    {inv.due_date && (
                      <p className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        <CalendarClock size={11} /> {formatDateIndoShort(inv.due_date)}
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${badgeClass}`}>
                    {inv.status === 'paid' ? 'Lunas' : overdue ? 'Jatuh Tempo' : 'Pending'}
                  </span>
                  <div className="flex gap-1.5">
                    <button type="button" aria-label="Lihat dokumen" onClick={() => openPreview(inv)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Eye size={14} /></button>
                    {canDelete && <button type="button" aria-label="Hapus dokumen" onClick={() => handleDeleteInvoice(inv)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom nav khusus Instansi — menggantikan nav aplikasi selama di halaman ini (lihat App.jsx). */}
      <nav aria-label="Menu Instansi" className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 h-14 flex justify-between items-center px-2 z-20 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] shrink-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto print:hidden">
        <div className="flex w-full justify-between items-center relative">
          <div className="flex justify-around w-[42%]">
            <NavTab icon={Home} label="Beranda" onClick={() => navigate('/')} />
            <NavTab icon={Building2} label="Klien" active={tab === 'clients'} onClick={() => setTab('clients')} />
          </div>
          <div className="w-[16%]" />
          <div className="flex justify-around w-[42%]">
            <NavTab icon={FileText} label="Invoice" active={tab === 'invoices'} onClick={() => setTab('invoices')} badge={pendingOf('invoice')} />
            <NavTab icon={Receipt} label="Faktur" active={tab === 'faktur'} onClick={() => setTab('faktur')} badge={pendingOf('faktur')} />
            <NavTab icon={Layers} label="Massal" active={tab === 'multipate'} onClick={() => setTab('multipate')} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -top-5 flex items-center justify-center z-30">
            <button
              type="button"
              onClick={fab.run}
              aria-label={fab.label}
              title={fab.label}
              className="w-[52px] h-[52px] bg-gray-900 rounded-full flex items-center justify-center text-white shadow-md shadow-gray-900/30 border-2 border-white hover:bg-black hover:scale-105 active:scale-90 transition-all duration-200"
            >
              {tab === 'multipate' ? <Layers size={22} /> : <Plus size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {showClientForm && (
        <InstansiClientForm
          client={editingClient}
          packages={internetPackages}
          onClose={() => { setShowClientForm(false); setEditingClient(null); }}
          onSave={handleSaveClient}
        />
      )}

      {showInvoiceForm && (
        <InstansiInvoiceForm
          kind={tab === 'faktur' ? 'faktur' : 'invoice'}
          clients={clients}
          internetPackages={internetPackages}
          existingInvoiceNumbers={existingInvoiceNumbers}
          onClose={() => setShowInvoiceForm(false)}
          onCreated={(row) => { setShowInvoiceForm(false); loadAll(); openPreview(row); }}
        />
      )}

      {showMultipate && (
        <InstansiMultipate
          clients={clients}
          profile={profile}
          internetPackages={internetPackages}
          existingInvoiceNumbers={existingInvoiceNumbers}
          onCreatedMany={() => loadAll()}
          onClose={() => setShowMultipate(false)}
        />
      )}

      {previewItem && (
        <InstansiPreviewModal
          invoiceData={previewItem.invoiceData}
          lineItems={previewItem.lineItems}
          subtotal={previewItem.subtotal}
          profile={profile}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
};

export default Instansi;
