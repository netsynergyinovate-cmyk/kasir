import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONFIGURABLE_ADMIN_MENUS, ADMIN_ALLOWED_PATHS } from '../utils/permissions';

// Superadmin mengatur, KHUSUS untuk satu admin ini: menu apa saja yang boleh dibuka, dan (opsional)
// pelanggan mana saja yang boleh dia lihat/transaksikan. Dua-duanya per-akun, bukan pengaturan bersama.
const AdminAccessModal = ({ admin, onClose, onSaved }) => {
  const [menus, setMenus] = useState(admin.allowed_paths ?? ADMIN_ALLOWED_PATHS);
  const [restrictCustomers, setRestrictCustomers] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [customerSearch, setCustomerSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('customers').select('id, name, nickname').order('name'),
      supabase.from('admin_customer_access').select('customer_id').eq('admin_id', admin.id),
    ]).then(([custRes, accessRes]) => {
      if (cancelled) return;
      if (custRes.data) setCustomers(custRes.data);
      if (accessRes.data && accessRes.data.length > 0) {
        setRestrictCustomers(true);
        setSelectedCustomerIds(new Set(accessRes.data.map((r) => r.customer_id)));
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [admin.id]);

  const toggleMenu = (path) => {
    setMenus((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const toggleCustomer = (id) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleCustomers = customers.filter((c) =>
    !customerSearch.trim() || c.name.toLowerCase().includes(customerSearch.trim().toLowerCase()) || c.nickname?.toLowerCase().includes(customerSearch.trim().toLowerCase())
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const { error: menuError } = await supabase.from('admin_profiles').update({ allowed_paths: menus }).eq('id', admin.id);
      if (menuError) throw menuError;

      // Ganti seluruh daftar akses pelanggan admin ini: hapus dulu, baru masukkan yang dicentang (kalau
      // pembatasan dimatikan, dibiarkan kosong -> admin kembali melihat SEMUA pelanggan).
      const { error: delError } = await supabase.from('admin_customer_access').delete().eq('admin_id', admin.id);
      if (delError) throw delError;

      if (restrictCustomers && selectedCustomerIds.size > 0) {
        const rows = [...selectedCustomerIds].map((customer_id) => ({ admin_id: admin.id, customer_id }));
        const { error: insError } = await supabase.from('admin_customer_access').insert(rows);
        if (insError) throw insError;
      }

      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Gagal menyimpan akses: ' + err.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-5" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
          <X size={18} />
        </button>
        <div>
          <h3 className="text-lg font-black text-gray-900">Atur Akses</h3>
          <p className="text-xs text-gray-500">{admin.full_name}{admin.email ? ` · ${admin.email}` : ''}</p>
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-400 italic text-center py-6">Memuat...</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menu yang boleh dibuka</p>
              <div className="grid grid-cols-2 gap-2">
                {CONFIGURABLE_ADMIN_MENUS.map((m) => (
                  <label key={m.path} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${menus.includes(m.path) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                    <input type="checkbox" checked={menus.includes(m.path)} onChange={() => toggleMenu(m.path)} className="accent-blue-600" />
                    {m.label}
                  </label>
                ))}
              </div>
              {menus.length === 0 && <p className="text-[10px] text-red-600 font-semibold">Tidak ada menu dicentang — admin ini tidak akan bisa membuka aplikasi sama sekali.</p>}
            </div>

            <div className="space-y-2 pt-1 border-t border-gray-100">
              <label className="flex items-center justify-between pt-3">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Batasi pelanggan yang terlihat</span>
                <input type="checkbox" checked={restrictCustomers} onChange={(e) => setRestrictCustomers(e.target.checked)} className="accent-blue-600 w-4 h-4" />
              </label>
              <p className="text-[11px] text-gray-400">{restrictCustomers ? 'Hanya pelanggan yang dicentang yang terlihat admin ini.' : 'Mati: admin ini melihat semua pelanggan (bawaan).'}</p>

              {restrictCustomers && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Cari nama pelanggan..."
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-medium"
                  />
                  <p className="text-[10px] text-gray-400">{selectedCustomerIds.size} pelanggan dipilih</p>
                  <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-1.5">
                    {visibleCustomers.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-3">Tidak ada pelanggan cocok.</p>
                    ) : visibleCustomers.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-xs">
                        <input type="checkbox" checked={selectedCustomerIds.has(c.id)} onChange={() => toggleCustomer(c.id)} className="accent-blue-600" />
                        <span className="font-medium text-gray-700 truncate">{c.name}{c.nickname ? ` (${c.nickname})` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
              {isSaving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan Akses'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAccessModal;
