import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONFIGURABLE_ADMIN_MENUS, PERMISSION_MODULES, normalizeAdminAccess } from '../utils/permissions';
import { MAP_ICON_TYPES, MAP_ICON_COLORS, getInitials, getDeterministicColor } from '../utils/adminMapIcons';

// Superadmin mengatur, KHUSUS untuk satu admin ini: hak akses fitur granular, icon peta, dan
// (opsional) pelanggan mana saja yang boleh dia lihat/transaksikan.
const AdminAccessModal = ({ admin, onClose, onSaved }) => {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);

  const [activeSection, setActiveSection] = useState('access'); // 'access' | 'icon' | 'customers'
  const [menus, setMenus] = useState(currentAccess.paths);
  const [permissions, setPermissions] = useState(currentAccess.permissions);
  const [expandedModules, setExpandedModules] = useState(new Set(['pos']));

  // Map icon state
  const [iconType, setIconType] = useState(currentAccess.map_icon?.type || 'motor');
  const [iconColor, setIconColor] = useState(currentAccess.map_icon?.color || getDeterministicColor(admin.id || admin.full_name));
  const [iconLabel, setIconLabel] = useState(currentAccess.map_icon?.label || getInitials(admin.full_name));

  // Customer restriction state
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

  const togglePermission = (permId) => {
    setPermissions((prev) => prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]);
  };

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
  };

  const selectAllModule = (module) => {
    const modulePermIds = module.permissions.map((p) => p.id);
    setPermissions((prev) => [...new Set([...prev, ...modulePermIds])]);
    // Ensure module path is also enabled
    if (module.path && !menus.includes(module.path)) {
      setMenus((prev) => [...prev, module.path]);
    }
  };

  const deselectAllModule = (module) => {
    const modulePermIds = new Set(module.permissions.map((p) => p.id));
    setPermissions((prev) => prev.filter((p) => !modulePermIds.has(p)));
  };

  const toggleCustomer = (id) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleCustomers = customers.filter((c) =>
    !customerSearch.trim() || (c.name || '').toLowerCase().includes(customerSearch.trim().toLowerCase()) || c.nickname?.toLowerCase().includes(customerSearch.trim().toLowerCase())
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      // Build the new structured allowed_paths object
      const newAllowedPaths = {
        paths: menus,
        permissions: permissions,
        map_icon: { type: iconType, color: iconColor, label: iconLabel },
        commissions: currentAccess.commissions || [],
      };

      const { error: menuError } = await supabase.from('admin_profiles').update({ allowed_paths: newAllowedPaths }).eq('id', admin.id);
      if (menuError) throw menuError;

      // Ganti seluruh daftar akses pelanggan admin ini
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

  const selectedMatchedType = MAP_ICON_TYPES.find((t) => t.id === iconType) || MAP_ICON_TYPES[0];

  const SECTIONS = [
    { key: 'access', label: 'Hak Akses Fitur', icon: '🔐' },
    { key: 'icon', label: 'Icon Peta', icon: '📍' },
    { key: 'customers', label: 'Batasi Pelanggan', icon: '👥' },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-backdrop" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 relative space-y-4 animate-sheet-up sm:animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
          <X size={18} />
        </button>
        <div>
          <h3 className="text-lg font-black text-gray-900">Atur Akses</h3>
          <p className="text-xs text-gray-500">{admin.full_name}{admin.email ? ` · ${admin.email}` : ''}</p>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-bold transition-all ${activeSection === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className="mr-1">{s.icon}</span>{s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-400 italic text-center py-6">Memuat...</p>
        ) : (
          <>
            {/* SECTION: Hak Akses Fitur */}
            {activeSection === 'access' && (
              <div className="space-y-3">
                {/* Menu Halaman */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menu yang boleh dibuka</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CONFIGURABLE_ADMIN_MENUS.map((m) => (
                      <label key={m.path} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${menus.includes(m.path) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                        <input type="checkbox" checked={menus.includes(m.path)} onChange={() => toggleMenu(m.path)} className="accent-blue-600 w-3.5 h-3.5" />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  {menus.length === 0 && <p className="text-[10px] text-red-600 font-semibold">Tidak ada menu dicentang — admin tidak bisa membuka aplikasi.</p>}
                </div>

                {/* Granular Permissions per Module */}
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">Hak Akses Fitur per Modul</p>
                  {PERMISSION_MODULES.map((module) => {
                    const isExpanded = expandedModules.has(module.id);
                    const modulePermIds = module.permissions.map((p) => p.id);
                    const checkedCount = modulePermIds.filter((id) => permissions.includes(id)).length;
                    const allChecked = checkedCount === modulePermIds.length;

                    return (
                      <div key={module.id} className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleModule(module.id)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center ${allChecked ? 'bg-blue-600 text-white' : checkedCount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                              {checkedCount}
                            </span>
                            <div className="text-left">
                              <p className="text-xs font-bold text-gray-800">{module.label}</p>
                              <p className="text-[9px] text-gray-400">{module.description}</p>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </button>

                        {isExpanded && (
                          <div className="p-3 space-y-1.5 bg-white">
                            <div className="flex gap-2 mb-2">
                              <button type="button" onClick={() => selectAllModule(module)} className="text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors">
                                ✅ Pilih Semua
                              </button>
                              <button type="button" onClick={() => deselectAllModule(module)} className="text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors">
                                ❌ Batal Semua
                              </button>
                            </div>
                            {module.permissions.map((perm) => (
                              <label key={perm.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${permissions.includes(perm.id) ? 'border-blue-200 bg-blue-50/50 text-blue-800' : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}>
                                <input type="checkbox" checked={permissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} className="accent-blue-600 w-3.5 h-3.5" />
                                <span className="text-[11px] font-medium">{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION: Icon Peta */}
            {activeSection === 'icon' && (
              <div className="space-y-4">
                {/* Live Preview */}
                <div className="flex justify-center py-3">
                  <div className="relative flex flex-col items-center" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))' }}>
                    <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '9999px', background: iconColor, border: '3px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }}>
                      <span dangerouslySetInnerHTML={{ __html: selectedMatchedType.svg.replace('width="18"', 'width="24"').replace('height="18"', 'height="24"') }} />
                      <div style={{ position: 'absolute', top: -5, right: -5, background: '#ffffff', color: iconColor, fontSize: 11, fontWeight: 900, padding: '1px 4px', borderRadius: '9999px', border: `1.5px solid ${iconColor}`, lineHeight: 1 }}>
                        {iconLabel}
                      </div>
                    </div>
                    <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `7px solid ${iconColor}`, marginTop: -2 }} />
                    <div className="mt-1 bg-slate-800/85 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md whitespace-nowrap">
                      {admin.full_name}
                    </div>
                  </div>
                </div>

                {/* Jenis Icon */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Jenis Icon</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MAP_ICON_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setIconType(t.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[9px] font-bold transition-all ${iconType === t.id ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        <span className="text-lg">{t.iconText}</span>
                        <span className="truncate w-full text-center">{t.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Warna Tema */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Warna Tema</p>
                  <div className="flex gap-2 flex-wrap">
                    {MAP_ICON_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setIconColor(c.value)}
                        className={`w-9 h-9 rounded-xl border-2 transition-all ${iconColor === c.value ? 'border-gray-800 scale-110 ring-2 ring-offset-1 ring-gray-300' : 'border-transparent hover:scale-105'}`}
                        style={{ background: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Inisial / Label */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inisial / Label (1-3 karakter)</p>
                  <input
                    type="text"
                    maxLength={3}
                    value={iconLabel}
                    onChange={(e) => setIconLabel(e.target.value.toUpperCase())}
                    className="w-24 p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-black text-center uppercase"
                  />
                </div>
              </div>
            )}

            {/* SECTION: Batasi Pelanggan */}
            {activeSection === 'customers' && (
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between">
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
            )}

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
