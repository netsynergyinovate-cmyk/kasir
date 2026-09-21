import { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { searchCustomers } from '../utils/visits';

// Modal untuk memilih pelanggan Runsnet mana saja yang diimpor ke KAsir — bukan menarik semua
// sekaligus. Superadmin mencentang satu per satu, lalu klik "Impor Terpilih".
const RunsnetCustomerPicker = ({ session, existingCustids, onClose, onImported }) => {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/runsnet/customers-list', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        setCustomers(result.customers || []);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  const filtered = useMemo(
    () => searchCustomers(customers, query).slice(0, 200),
    [customers, query],
  );

  const toggle = (custid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(custid)) next.delete(custid);
      else next.add(custid);
      return next;
    });
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await fetch('/api/runsnet/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ custids: [...selected] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      await onImported();
      alert(`Berhasil diimpor: ${result.total} pelanggan (${result.created} baru, ${result.updated} diperbarui).`);
      onClose();
    } catch (err) {
      alert('Gagal mengimpor: ' + err.message);
    }
    setIsImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5 space-y-4 relative max-h-[90vh] flex flex-col">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"><X size={18} /></button>
        <div>
          <h3 className="text-lg font-black text-gray-900">Pilih Pelanggan dari Runsnet</h3>
          <p className="text-xs text-gray-500">Centang pelanggan yang ingin dimasukkan ke KAsir. Yang tidak dicentang tidak akan disentuh.</p>
        </div>

        <div className="relative shrink-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama / CustID"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-indigo-500 placeholder:text-gray-400 placeholder:font-medium"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 min-h-[200px]">
          {isLoading ? (
            <p className="text-xs text-gray-400 italic text-center py-6 flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Mengambil daftar dari Runsnet...</p>
          ) : loadError ? (
            <p className="text-xs text-red-600 text-center py-6">Gagal memuat: {loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-6">Tidak ada pelanggan yang cocok.</p>
          ) : (
            filtered.map((c) => {
              const alreadyImported = existingCustids.has(c.custid);
              return (
                <label key={c.custid} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer ${selected.has(c.custid) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="checkbox" checked={selected.has(c.custid)} onChange={() => toggle(c.custid)} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{c.custid} · {c.package}{alreadyImported ? ' · sudah ada di KAsir' : ''}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={handleImport}
          disabled={selected.size === 0 || isImporting}
          className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 text-white font-black py-3 rounded-xl disabled:opacity-50 shrink-0"
        >
          {isImporting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {isImporting ? 'Mengimpor...' : `Impor Terpilih (${selected.size})`}
        </button>
      </div>
    </div>
  );
};

export default RunsnetCustomerPicker;
