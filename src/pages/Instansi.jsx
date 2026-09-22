import { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Receipt, Layers, Plus, Trash2, Pencil, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import InstansiClientForm from '../components/InstansiClientForm';
import InstansiInvoiceForm from '../components/InstansiInvoiceForm';
import InstansiMultipate from '../components/InstansiMultipate';
import InstansiPreviewModal from '../components/InstansiPreviewModal';
import { formatDateIndo, amountInWords } from '../utils/instansiInvoice';

const TABS = [
  { key: 'clients', label: 'Klien', icon: Building2 },
  { key: 'invoices', label: 'Invoice', icon: FileText },
  { key: 'faktur', label: 'Faktur', icon: Receipt },
  { key: 'multipate', label: 'Massal', icon: Layers },
];

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

  const invoicesForTab = invoices.filter((i) => i.kind === (tab === 'faktur' ? 'faktur' : 'invoice'));

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
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide whitespace-nowrap transition-all ${tab === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-xs text-gray-400 italic py-10">Memuat...</p>
      ) : tab === 'clients' ? (
        <div className="space-y-3">
          <button type="button" onClick={() => { setEditingClient(null); setShowClientForm(true); }} className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus size={16} /> Tambah Klien
          </button>
          {clients.length === 0 ? (
            <p className="text-center text-xs text-gray-400 italic py-10">Belum ada klien instansi.</p>
          ) : clients.map((c) => (
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
          <button type="button" onClick={() => setShowInvoiceForm(true)} disabled={clients.length === 0} className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus size={16} /> Terbitkan {tab === 'faktur' ? 'Faktur' : 'Invoice'}
          </button>
          {invoicesForTab.length === 0 ? (
            <p className="text-center text-xs text-gray-400 italic py-10">Belum ada {tab === 'faktur' ? 'faktur' : 'invoice'}.</p>
          ) : invoicesForTab.map((inv) => (
            <div key={inv.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1" onClick={() => openPreview(inv)}>
                <p className="font-black text-gray-900 text-sm truncate">{inv.client?.institution_name || 'Klien terhapus'}</p>
                <p className="font-mono text-[10px] text-gray-400 truncate">{inv.invoice_number}</p>
                <p className="text-xs font-bold text-gray-700 mt-1">Rp {new Intl.NumberFormat('id-ID').format(inv.amount)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{inv.status === 'paid' ? 'Lunas' : 'Pending'}</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => openPreview(inv)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Eye size={14} /></button>
                  <button type="button" onClick={() => handleDeleteInvoice(inv)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
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
