import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, PlusCircle, Wifi, Trash2, Pencil, MapPin, LayoutGrid, List, 
  Calendar, User, RefreshCw, Key, Phone, Network, ShieldCheck, CheckCircle2, 
  ExternalLink, Info, X 
} from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';
import { formatRupiah } from '../utils/format';
import { TONE_BADGE_CLASSES } from '../utils/visits';

const Pelanggan = ({ customers = [], packages = [], role, visitStatusById = {}, setShowAddCustomer, onDeleteCustomer, onUpdateCustomer, onSyncEbilling }) => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ebilling' | 'aktif' | 'isolir'
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedDetailCust, setSelectedDetailCust] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchTerm(q);
  }, [searchParams]);

  const ebillingCount = customers.filter(c => c.source === 'E-Billing' || c.pppoe_id || c.pppoeId).length;
  const aktifCount = customers.filter(c => c.status === 'aktif').length;
  const isolirCount = customers.filter(c => c.status !== 'aktif').length;

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const pppoe = (c.pppoe_id || c.pppoeId || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const ip = (c.ip_address || c.ipAddress || '').toLowerCase();

    const matchesSearch = (
      c.name.toLowerCase().includes(term) || 
      (c.nickname && c.nickname.toLowerCase().includes(term)) ||
      c.address.toLowerCase().includes(term) ||
      pppoe.includes(term) ||
      phone.includes(term) ||
      ip.includes(term)
    );

    if (!matchesSearch) return false;

    if (activeTab === 'ebilling') return c.source === 'E-Billing' || c.pppoe_id || c.pppoeId;
    if (activeTab === 'aktif') return c.status === 'aktif';
    if (activeTab === 'isolir') return c.status !== 'aktif';
    return true;
  });

  const handleSaveEdit = (updatedData) => {
    onUpdateCustomer(updatedData);
    setEditingCustomer(null);
  };

  const handleSync = async () => {
    if (onSyncEbilling) {
      setIsSyncing(true);
      await onSyncEbilling();
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Data Pelanggan</h2>
          <p className="text-xs text-gray-500">Tersambung ke E-Billing POS System ({customers.length} Total)</p>
        </div>
        <div className="flex gap-2">
          {onSyncEbilling && (
            <button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 border border-emerald-200 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-emerald-600" : "text-emerald-600"} />
              {isSyncing ? 'Menarik...' : 'Sinkron E-Billing'}
            </button>
          )}
          <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200 active:scale-95 transition-all">
            <PlusCircle size={16} /> Tambah
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button 
          onClick={() => setActiveTab('all')} 
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'all' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Semua ({customers.length})
        </button>
        <button 
          onClick={() => setActiveTab('ebilling')} 
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === 'ebilling' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-indigo-700 border border-indigo-200'}`}
        >
          <ShieldCheck size={13} /> E-Billing ({ebillingCount})
        </button>
        <button 
          onClick={() => setActiveTab('aktif')} 
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'aktif' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-700 border border-green-200'}`}
        >
          Aktif ({aktifCount})
        </button>
        <button 
          onClick={() => setActiveTab('isolir')} 
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'isolir' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-red-700 border border-red-200'}`}
        >
          Isolir ({isolirCount})
        </button>
      </div>
      
      {/* Search and Toggle Row */}
      <div className="flex gap-2">
        <div className="bg-white flex-1 flex items-center p-2 rounded-xl border border-gray-200 shadow-sm">
          <Search size={20} className="text-gray-400 ml-2" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, ID PPPoE, No. WA, IP, atau alamat..." 
            className="bg-transparent border-none outline-none p-2 w-full text-sm" 
          />
        </div>
        <div className="bg-white flex items-center p-1 rounded-xl border border-gray-200 shadow-sm">
           <button 
             onClick={() => setViewMode('grid')}
             className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
           >
             <LayoutGrid size={18} />
           </button>
           <button 
             onClick={() => setViewMode('list')}
             className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
           >
             <List size={18} />
           </button>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-10 opacity-50 italic text-sm">Pelanggan tidak ditemukan...</div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW (Widget) */
        <div className="grid grid-cols-2 gap-3 mt-4">
          {filteredCustomers.map((cust) => {
            const pppoe = cust.pppoe_id || cust.pppoeId;
            const isEbilling = cust.source === 'E-Billing' || pppoe;
            return (
              <div 
                key={cust.id} 
                className={`bg-white p-3 rounded-xl border shadow-sm relative group hover:shadow-md transition-all ${cust.status !== 'aktif' ? 'border-red-100 bg-red-50/20' : 'border-gray-200'}`}
              >
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button onClick={() => setSelectedDetailCust(cust)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Lihat Rincian E-Billing"><Info size={13}/></button>
                  {role === 'superadmin' && (
                    <>
                      <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={12}/></button>
                      <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </>
                  )}
                </div>
                
                <div className="flex flex-col items-center text-center mb-3 pt-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm mb-2 relative ${cust.status === 'aktif' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'} border`}>
                    <User size={20} />
                    {isEbilling && (
                      <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-0.5 rounded-full border border-white" title="Tersinkron E-Billing">
                        <CheckCircle2 size={12} />
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">{cust.name}</h3>
                  {cust.nickname && <p className="text-gray-400 font-medium text-[10px] mt-0.5">({cust.nickname})</p>}
                  {visitStatusById[cust.id] && (
                    <span className={`inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${TONE_BADGE_CLASSES[visitStatusById[cust.id].tone]}`}>{visitStatusById[cust.id].label}</span>
                  )}
                  
                  {pppoe && (
                    <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Key size={10} className="text-blue-500" /> {pppoe}
                    </span>
                  )}

                  <div className="flex gap-1 mt-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${cust.status === 'aktif' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
                      <span className={`w-1 h-1 rounded-full mr-1 ${cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}`}></span> {cust.status}
                    </span>
                    {isEbilling && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        E-Billing
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-400 flex items-center gap-1"><Wifi size={10}/> Paket</span>
                    <span className="font-bold text-gray-700 truncate max-w-[80px]" title={cust.package}>{cust.package}</span>
                  </div>
                  {cust.phone && (
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-400 flex items-center gap-1"><Phone size={10}/> WA</span>
                      <a href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="font-bold text-green-600 hover:underline flex items-center gap-0.5">
                        {cust.phone} <ExternalLink size={9}/>
                      </a>
                    </div>
                  )}
                  {cust.ip_address && (
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-400 flex items-center gap-1"><Network size={10}/> IP PPPoE</span>
                      <span className="font-mono font-bold text-gray-700">{cust.ip_address}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-400 flex items-center gap-1"><Calendar size={10}/> Tgl Bayar</span>
                    <span className={`font-bold ${cust.status === 'aktif' ? 'text-gray-700' : 'text-red-600'}`}>{cust.due_date || cust.dueDate}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW (Table) */
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-4">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Pelanggan & ID PPPoE</div>
              <div className="col-span-3">Kontak & IP</div>
              <div className="col-span-3">Paket & Lokasi</div>
              <div className="col-span-2 text-right">Aksi</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredCustomers.map((cust) => {
              const pppoe = cust.pppoe_id || cust.pppoeId;
              const isEbilling = cust.source === 'E-Billing' || pppoe;
              return (
                <div key={cust.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-gray-50 transition-colors group ${cust.status !== 'aktif' ? 'bg-red-50/10' : ''}`}>
                  <div className="col-span-1 sm:col-span-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${cust.status === 'aktif' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          <User size={16} />
                      </div>
                      <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-900 leading-none">{cust.name} {cust.nickname && <span className="text-gray-400 font-medium text-[10px]">({cust.nickname})</span>}</p>
                            {visitStatusById[cust.id] && (
                              <span className={`inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${TONE_BADGE_CLASSES[visitStatusById[cust.id].tone]}`}>{visitStatusById[cust.id].label}</span>
                            )}
                            {isEbilling && (
                              <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-indigo-200">E-Billing</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-gray-500">ID: {cust.id} • Tgl: {cust.due_date || cust.dueDate}</p>
                            {pppoe && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                <Key size={9}/> {pppoe}
                              </span>
                            )}
                          </div>
                      </div>
                  </div>

                  <div className="col-span-1 sm:col-span-3 space-y-1 text-xs">
                    {cust.phone ? (
                      <a href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-green-700 font-bold hover:underline">
                        <Phone size={12}/> {cust.phone}
                      </a>
                    ) : <span className="text-gray-300 text-[10px] italic">No. WA -</span>}
                    {cust.ip_address && (
                      <p className="text-[10px] font-mono text-gray-600 flex items-center gap-1">
                        <Network size={11}/> {cust.ip_address}
                      </p>
                    )}
                  </div>

                  <div className="col-span-1 sm:col-span-3">
                      <div className="flex items-center gap-1.5 mb-1">
                          <Wifi size={12} className="text-blue-500"/>
                          <span className="text-[11px] font-bold text-gray-700">{cust.package}</span>
                          {cust.price && <span className="text-[10px] text-emerald-600 font-bold">({formatRupiah(cust.price)})</span>}
                      </div>
                      <div className="flex items-start gap-1.5">
                          <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0"/>
                          <span className="text-[10px] text-gray-500 truncate">{cust.address}</span>
                      </div>
                  </div>
                  <div className="col-span-1 sm:col-span-2 flex justify-end gap-1">
                      <button onClick={() => setSelectedDetailCust(cust)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Detail E-Billing"><Info size={14}/></button>
                      {role === 'superadmin' && (
                        <>
                          <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil size={14}/></button>
                          <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                        </>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Detail E-Billing Modal */}
      {selectedDetailCust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} />
                <h3 className="font-bold text-base">Rincian Data E-Billing Pelanggan</h3>
              </div>
              <button onClick={() => setSelectedDetailCust(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={20}/></button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg border border-blue-200">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base">{selectedDetailCust.name}</h4>
                  <p className="text-xs text-gray-500 font-medium">ID Kasir: {selectedDetailCust.id}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${selectedDetailCust.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    Status: {selectedDetailCust.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                  <span className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1"><Key size={12}/> custid / ID E-Billing</span>
                  <p className="font-mono font-bold text-blue-900 text-xs mt-1">{selectedDetailCust.custid || selectedDetailCust.customer_id || selectedDetailCust.id || '-'}</p>
                </div>
                <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase flex items-center gap-1"><Key size={12}/> ID PPPoE</span>
                  <p className="font-mono font-bold text-indigo-900 text-xs mt-1">{selectedDetailCust.pppoe_id || selectedDetailCust.pppoeId || '-'}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                  <span className="text-gray-500 font-medium">Paket Internet:</span>
                  <span className="font-bold text-gray-800">{selectedDetailCust.package}</span>
                </div>
                {selectedDetailCust.price && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">Tagihan E-Billing:</span>
                    <span className="font-black text-emerald-600">{formatRupiah(selectedDetailCust.price)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                  <span className="text-gray-500 font-medium">Tanggal Bayar Bulanan:</span>
                  <span className="font-bold text-gray-800">Tgl {selectedDetailCust.due_date || selectedDetailCust.dueDate} setiap bulan</span>
                </div>
                {selectedDetailCust.last_payment_date && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">Bayar Terakhir:</span>
                    <span className="font-bold text-gray-800">{selectedDetailCust.last_payment_date}</span>
                  </div>
                )}
                {selectedDetailCust.phone && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">No. WA / HP:</span>
                    <a href={`https://wa.me/${selectedDetailCust.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="font-bold text-green-600 hover:underline flex items-center gap-1">
                      {selectedDetailCust.phone} <ExternalLink size={12}/>
                    </a>
                  </div>
                )}
                {selectedDetailCust.ip_address && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">IP Address PPPoE:</span>
                    <span className="font-mono font-bold text-gray-800">{selectedDetailCust.ip_address}</span>
                  </div>
                )}
                {selectedDetailCust.mac_address && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">MAC Address:</span>
                    <span className="font-mono font-bold text-gray-800">{selectedDetailCust.mac_address}</span>
                  </div>
                )}
                {selectedDetailCust.serial_number && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">Serial Number (SN ONU):</span>
                    <span className="font-mono font-bold text-gray-800">{selectedDetailCust.serial_number}</span>
                  </div>
                )}
                {selectedDetailCust.router_name && (
                  <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-500 font-medium">Router / Server:</span>
                    <span className="font-bold text-gray-800">{selectedDetailCust.router_name}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                  <span className="text-gray-500 font-medium">Alamat Pemasangan:</span>
                  <span className="font-medium text-gray-800 text-right max-w-[200px]">{selectedDetailCust.address}</span>
                </div>
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-gray-500 font-medium">Sumber Data & Sinkron:</span>
                  <span className="font-bold text-indigo-600">{selectedDetailCust.source || 'E-Billing System'}</span>
                </div>
              </div>

              <button 
                onClick={() => setSelectedDetailCust(null)}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all text-xs"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCustomer && (
        <EditCustomerModal 
          customer={editingCustomer} 
          packages={packages} 
          onClose={() => setEditingCustomer(null)} 
          onSave={handleSaveEdit} 
        />
      )}
    </div>
  );
};

export default Pelanggan;
