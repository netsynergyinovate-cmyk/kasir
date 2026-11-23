import { useState, useEffect } from 'react';
import {
  X, Loader2, CheckCircle2, ChevronDown, Home, ShoppingCart, Users, Receipt, Route, MessageCircle,
  Wallet, Building2, Settings, Zap, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  CONFIGURABLE_ADMIN_MENUS, PERMISSION_MODULES, ALL_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS, normalizeAdminAccess,
} from '../utils/permissions';
import { MAP_ICON_TYPES, MAP_ICON_COLORS, getInitials, getDeterministicColor } from '../utils/adminMapIcons';
import ToggleSwitch from './ToggleSwitch';

const MODULE_ICONS = {
  pos: ShoppingCart, customers: Users, history: Receipt, rute: Route, whatsapp: MessageCircle,
  finance: Wallet, instansi: Building2, settings: Settings, runsnet: Zap,
};

const ALL_MENU_PATHS = CONFIGURABLE_ADMIN_MENUS.map((m) => m.path);
const isMenuPath = (path) => ALL_MENU_PATHS.includes(path);

// Titik awal cepat; superadmin tetap bisa menyesuaikan per saklar sesudahnya.
const PRESETS = [
  { key: 'kasir', label: 'Kasir', paths: ALL_MENU_PATHS, permissions: DEFAULT_ADMIN_PERMISSIONS },
  {
    key: 'penagih', label: 'Penagih Lapangan', paths: ['/', '/pos', '/customers'],
    permissions: ['pos.view', 'pos.retail', 'pos.print', 'customers.view', 'rute.view', 'rute.visit', 'whatsapp.invoice', 'whatsapp.reminder'],
  },
  { key: 'penuh', label: 'Akses Penuh', paths: ALL_MENU_PATHS, permissions: ALL_PERMISSIONS },
];

const SECTIONS = [
  { key: 'access', label: 'Hak Akses', icon: '🔐' },
  { key: 'icon', label: 'Icon Peta', icon: '📍' },
  { key: 'customers', label: 'Batasi Pelanggan', icon: '👥' },
];

// Superadmin mengatur, KHUSUS untuk satu admin ini: hak akses fitur granular, icon peta, dan
// (opsional) pelanggan mana saja yang boleh dia lihat/transaksikan.
const AdminAccessModal = ({ admin, onClose, onSaved }) => {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);

  const [activeSection, setActiveSection] = useState('access'); // 'access' | 'icon' | 'customers'
  const [menus, setMenus] = useState(currentAccess.paths);
  const [permissions, setPermissions] = useState(currentAccess.permissions);
  const [expandedModules, setExpandedModules] = useState(new Set());

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

  // Halaman sebuah modul terbuka kalau hak "buka halaman"-nya aktif DAN (untuk menu navigasi) menunya dicentang.
  // Keduanya selalu diubah bersamaan supaya tidak pernah setengah terbuka.
  const isPageOpen = (module) => permissions.includes(module.viewPermission) && (!isMenuPath(module.path) || menus.includes(module.path));

  const setPageOpen = (module, open) => {
    setPermissions((prev) => (open ? [...new Set([...prev, module.viewPermission])] : prev.filter((p) => p !== module.viewPermission)));
    if (isMenuPath(module.path)) {
      setMenus((prev) => (open ? [...new Set([...prev, module.path])] : prev.filter((p) => p !== module.path)));
    }
  };

  const toggleBeranda = (open) => setMenus((prev) => (open ? [...new Set([...prev, '/'])] : prev.filter((p) => p !== '/')));

  // Mengaktifkan sebuah fitur otomatis membuka halaman modulnya; tanpa itu fiturnya tidak bisa dipakai.
  const togglePermission = (permId) => {
    if (permissions.includes(permId)) {
      setPermissions((prev) => prev.filter((p) => p !== permId));
      return;
    }
    setPermissions((prev) => [...new Set([...prev, permId])]);
    const owner = PERMISSION_MODULES.find((m) => m.permissions.some((p) => p.id === permId));
    if (owner?.viewPermission) setPageOpen(owner, true);
  };

  const selectAllModule = (module) => {
    setPermissions((prev) => [...new Set([...prev, ...module.permissions.map((p) => p.id)])]);
    if (module.viewPermission) setPageOpen(module, true);
  };

  const deselectAllModule = (module) => {
    const modulePermIds = new Set(module.permissions.map((p) => p.id));
    setPermissions((prev) => prev.filter((p) => !modulePermIds.has(p)));
    if (module.viewPermission) setPageOpen(module, false);
  };

  const applyPreset = (preset) => {
    setMenus(preset.paths);
    setPermissions(preset.permissions);
  };

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
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
      const newAllowedPaths = {
        paths: menus,
        permissions: permissions,
        map_icon: { type: iconType, color: iconColor, label: iconLabel },
        commissions: currentAccess.commissions || [],
        bonuses: currentAccess.bonuses || [],
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
  const activeCount = permissions.filter((p) => ALL_PERMISSIONS.includes(p)).length;

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-backdrop" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl relative animate-sheet-up sm:animate-pop-in" onClick={(e) => e.stopPropagation()}>
        {/* Kepala tetap: identitas admin + tab */}
        <div className="shrink-0 p-5 pb-3 space-y-3 border-b border-gray-100">
          <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-black shrink-0" style={{ background: iconColor }}>
              {iconLabel || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-gray-900 leading-tight">Atur Akses</h3>
              <p className="text-xs text-gray-500 truncate">{admin.full_name}{admin.email ? ` · ${admin.email}` : ''}</p>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(s.key)}
                className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${activeSection === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <span className="mr-1">{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Isi yang bisa digulir */}
        <div className="flex-1 overflow-y-auto p-5 pt-4">
          {isLoading ? (
            <p className="text-xs text-gray-400 italic text-center py-6">Memuat...</p>
          ) : (
            <>
              {/* SECTION: Hak Akses */}
              {activeSection === 'access' && (
                <div className="space-y-2.5">
                  {/* Ringkasan + preset cepat */}
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-600">
                        <span className="text-lg font-black text-blue-700">{activeCount}</span> / {ALL_PERMISSIONS.length} hak aktif
                      </p>
                      <span className="text-[10px] font-bold text-blue-700 flex items-center gap-1"><Sparkles size={12} /> Preset cepat</span>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(activeCount / ALL_PERMISSIONS.length) * 100}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map((preset) => (
                        <button key={preset.key} type="button" onClick={() => applyPreset(preset)} className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-[11px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white active:scale-95 transition-all">
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Beranda: satu-satunya halaman tanpa modul hak akses */}
                  <div className={`flex items-center gap-3 p-3 rounded-2xl border ${menus.includes('/') ? 'border-blue-200' : 'border-gray-200 bg-gray-50/60'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${menus.includes('/') ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      <Home size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">Beranda</p>
                      <p className="text-[11px] text-gray-400">Ringkasan harian, target & rute hari ini</p>
                    </div>
                    <ToggleSwitch label="Buka halaman Beranda" checked={menus.includes('/')} onChange={toggleBeranda} />
                  </div>

                  {PERMISSION_MODULES.map((module) => {
                    const Icon = MODULE_ICONS[module.id] || Settings;
                    const isExpanded = expandedModules.has(module.id);
                    const hasPage = Boolean(module.viewPermission);
                    const pageOpen = hasPage && isPageOpen(module);
                    const features = module.permissions.filter((perm) => perm.id !== module.viewPermission);
                    const activeFeatures = features.filter((perm) => permissions.includes(perm.id)).length;
                    const on = hasPage ? pageOpen : activeFeatures > 0;

                    return (
                      <div key={module.id} className={`rounded-2xl border transition-colors ${on ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50/60'}`}>
                        <div className="flex items-center gap-2 p-3">
                          <button type="button" onClick={() => toggleModule(module.id)} aria-expanded={isExpanded} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                              <Icon size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 leading-tight">{module.label}</p>
                              <p className={`text-[11px] truncate ${hasPage && !pageOpen ? 'text-gray-400' : 'text-blue-600 font-semibold'}`}>
                                {hasPage && !pageOpen ? 'Halaman ditutup' : `${activeFeatures} dari ${features.length} fitur aktif`}
                              </p>
                            </div>
                            <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {hasPage && (
                            <ToggleSwitch label={`Buka halaman ${module.label}`} checked={pageOpen} onChange={(open) => setPageOpen(module, open)} />
                          )}
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-1.5 border-t border-gray-100 pt-2.5">
                            <p className="text-[11px] text-gray-500 pb-0.5">{module.description}</p>
                            {features.map((perm) => (
                              <div key={perm.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors ${permissions.includes(perm.id) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <span className="text-xs font-semibold text-gray-700">{perm.label}</span>
                                <ToggleSwitch label={perm.label} checked={permissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} />
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button type="button" onClick={() => selectAllModule(module)} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">Aktifkan semua</button>
                              <button type="button" onClick={() => deselectAllModule(module)} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Matikan semua</button>
                            </div>
                            {hasPage && !pageOpen && (
                              <p className="text-[10px] text-gray-400">Mengaktifkan salah satu fitur otomatis membuka halamannya.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {menus.length === 0 && <p className="text-[11px] text-red-600 font-semibold">Tidak ada halaman yang dibuka — admin tidak bisa memakai aplikasi.</p>}
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
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-gray-200">
                    <div>
                      <p className="text-sm font-bold text-gray-800">Batasi pelanggan yang terlihat</p>
                      <p className="text-[11px] text-gray-400">{restrictCustomers ? 'Hanya pelanggan yang dicentang yang terlihat admin ini.' : 'Mati: admin ini melihat semua pelanggan (bawaan).'}</p>
                    </div>
                    <ToggleSwitch label="Batasi pelanggan yang terlihat" checked={restrictCustomers} onChange={setRestrictCustomers} />
                  </div>

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
                      <div className="max-h-72 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-1.5">
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
            </>
          )}
        </div>

        {/* Kaki tetap: tombol simpan selalu terlihat tanpa perlu menggulir */}
        <div className="shrink-0 p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={`w-full py-3 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all ${saved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
            {isSaving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan Akses'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminAccessModal;
