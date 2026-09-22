import { useEffect, useMemo, useState } from 'react';
import {
  Building2, FileText, Receipt, Layers, Plus, Trash2, Pencil, Eye, Search, X,
  Wallet, ListChecks, AlertCircle, TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import InstansiClientForm from '../components/InstansiClientForm';
import InstansiInvoiceForm from '../components/InstansiInvoiceForm';
import InstansiMultipate from '../components/InstansiMultipate';
import InstansiPreviewModal from '../components/InstansiPreviewModal';
import {
  formatDateIndo, formatNumber, amountInWords, summarizeInvoices, filterInvoices, filterClients,
} from '../utils/instansiInvoice';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const mapProfile = (row) => ({
  companyName: row?.name || '',
  address: row?.address || '',
  logoUrl: row?.logo_url || '',
  companyId: row?.invoice_company_id || '',
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

const Instansi = () => {
  const [tab, setTab] = useState('clients');
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

  const loadAll = async () => {
    const [clientsRes, invoicesRes, settingsRes] = await Promise.all([
      supabase.from('instansi_clients').select('*').order('institution_name'),
      supabase.from('instansi_invoices').select('*, client:instansi_clients(*)').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (invoicesRes.data) setInvoices(invoicesRes.data);
    if (settingsRes.data) {
      setProfile(mapProfile(settingsRes.data));
      setInternetPackages(Array.isArray(settingsRes.data.invoice_internet_packages) ? settingsRes.data.invoice_internet_packages : []);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const existingInvoiceNumbers = useMemo(() => invoices.map((i) => i.invoice_number), [invoices]);

  const TABS = useMemo(() => [
    { key: 'clients', label: 'Klien', icon: Building2, count: clients.length },
    { key: 'invoices', label: 'Invoice', icon: FileText, count: invoices.filter((i) => i.kind === 'invoice').length },
    { key: 'faktur', label: 'Faktur', icon: Receipt, count: invoices.filter((i) => i.kind === 'faktur').length },
    { key: 'multipate', label: 'Massal', icon: Layers },
  ], [clients, invoices]);

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

  return (
    <div className="p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-3xl p-6 text-white mb-4 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Invoice Instansi</h2>
          <p className="text-gray-300 text-xs mt-1">Klien, Invoice, Faktur & Terbit Massal (B2B)</p>
        </div>
        <Building2 size={40} className="text-gray-600 opacity-50" />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide whitespace-nowrap transition-all ${tab === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            <Icon size={14} /> {label}
            {typeof count === 'number' && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-xs text-gray-400 italic py-10">Memuat...</p>
      ) : tab === 'clients' ? (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <StatCard icon={Building2} label="Total Klien" value={clientStats.total} tone="bg-gray-100" active={clientStatusFilter === 'all'} onClick={() => setClientStatusFilter('all')} />
            <StatCard icon={ListChecks} label="Aktif" value={clientStats.active} tone="bg-emerald-50 text-emerald-600" active={clientStatusFilter === 'active'} onClick={() => setClientStatusFilter('active')} />
            <StatCard icon={AlertCircle} label="Nonaktif" value={clientStats.inactive} tone="bg-gray-100 text-gray-400" active={clientStatusFilter === 'inactive'} onClick={() => setClientStatusFilter('inactive')} />
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} type="text" placeholder="Cari nama instansi / kode klien..." className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs" />
          </div>

          <button type="button" onClick={() => { setEditingClient(null); setShowClientForm(true); }} className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus size={16} /> Tambah Klien
          </button>

          {visibleClients.length === 0 ? (
            <p className="text-center text-xs text-gray-400 italic py-10">{clients.length === 0 ? 'Belum ada klien instansi.' : 'Tidak ada klien yang cocok.'}</p>
          ) : visibleClients.map((c) => (
            <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-gray-900 text-sm uppercase truncate">{c.institution_name}</p>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest">{c.client_code} · {c.status === 'active' ? 'Aktif' : 'Nonaktif'}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{c.service_package || '-'}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button type="button" onClick={() => { setEditingClient(c); setShowClientForm(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Pencil size={14} /></button>
                <button type="button" onClick={() => handleDeleteClient(c)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'multipate' ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setShowMultipate(true)} disabled={clients.length === 0} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Layers size={16} /> Buka Generator Massal
          </button>
          {clients.length === 0 && <p className="text-center text-xs text-gray-400 italic py-6">Tambah klien dulu di tab Klien.</p>}
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
            <input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} type="text" placeholder="Cari nomor dokumen / nama instansi..." className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs" />
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

          <button type="button" onClick={() => setShowInvoiceForm(true)} disabled={clients.length === 0} className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus size={16} /> Terbitkan {tab === 'faktur' ? 'Faktur' : 'Invoice'}
          </button>

          {visibleInvoices.length === 0 ? (
            <p className="text-center text-xs text-gray-400 italic py-10">{invoicesForKind.length === 0 ? `Belum ada ${tab === 'faktur' ? 'faktur' : 'invoice'}.` : 'Tidak ada dokumen yang cocok dengan filter.'}</p>
          ) : visibleInvoices.map((inv) => {
            const overdue = isOverdue(inv);
            return (
              <div key={inv.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1" onClick={() => openPreview(inv)}>
                  <p className="font-black text-gray-900 text-sm truncate">{inv.client?.institution_name || 'Klien terhapus'}</p>
                  <p className="font-mono text-[10px] text-gray-400 truncate">{inv.invoice_number}</p>
                  <p className="text-xs font-bold text-gray-700 mt-1">Rp {formatNumber(inv.amount)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : overdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    {inv.status === 'paid' ? 'Lunas' : overdue ? 'Jatuh Tempo' : 'Pending'}
                  </span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => openPreview(inv)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Eye size={14} /></button>
                    <button type="button" onClick={() => handleDeleteInvoice(inv)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
