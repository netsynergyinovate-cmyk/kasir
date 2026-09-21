import { useState, useEffect } from 'react';
import { UserPlus, RotateCcw, Smartphone, Loader2, X, Clock, MapPin, Lock, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ACCOUNT_COLUMNS = 'id, full_name, email, role, device_id, device_label, last_login_at, last_login_device, last_login_location, last_login_ip';

const formatLastLogin = (iso) => {
  if (!iso) return 'Belum pernah login';
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AdminAccountsPanel = () => {
  const [accounts, setAccounts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAll = () => Promise.all([
    supabase
      .from('admin_profiles')
      .select(ACCOUNT_COLUMNS)
      .order('last_login_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('admin_invites')
      .select('email, full_name, created_at')
      .order('created_at', { ascending: false }),
  ]);

  const applyResults = ([accountsRes, invitesRes]) => {
    if (!accountsRes.error && accountsRes.data) setAccounts(accountsRes.data);
    if (!invitesRes.error && invitesRes.data) setInvites(invitesRes.data);
    setIsLoading(false);
  };

  const loadAdmins = async () => applyResults(await fetchAll());

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((results) => {
      if (!cancelled) applyResults(results);
    });
    return () => { cancelled = true; };
  }, []);

  const handleInviteAdmin = async (e) => {
    e.preventDefault();
    setFormError(null);

    const email = formEmail.trim().toLowerCase();
    const fullName = formName.trim();
    if (accounts.some((acc) => acc.email?.toLowerCase() === email)) {
      setFormError('Email ini sudah terdaftar sebagai akun.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('admin_invites').insert({ email, full_name: fullName });
    setIsSubmitting(false);

    if (error) {
      setFormError(error.code === '23505' ? 'Email ini sudah diundang.' : 'Gagal menyimpan undangan: ' + error.message);
      return;
    }

    setShowCreateModal(false);
    setFormName('');
    setFormEmail('');
    await loadAdmins();
  };

  const handleCancelInvite = async (email) => {
    if (!window.confirm(`Batalkan undangan untuk ${email}?`)) return;
    const { error } = await supabase.from('admin_invites').delete().eq('email', email);
    if (error) {
      alert('Gagal membatalkan undangan: ' + error.message);
    } else {
      await loadAdmins();
    }
  };

  const handleResetDevice = async (adminId) => {
    if (!window.confirm('Reset device akun ini? Admin akan bisa login dari device baru setelah ini.')) return;
    setResettingId(adminId);
    const { error } = await supabase
      .from('admin_profiles')
      .update({ device_id: null, device_label: null })
      .eq('id', adminId);

    if (error) {
      alert('Gagal reset device: ' + error.message);
    } else {
      await loadAdmins();
    }
    setResettingId(null);
  };

  const handleDeleteAdmin = async (acc) => {
    if (!window.confirm(`Hapus admin "${acc.full_name}" (${acc.email || 'tanpa email'})? Akunnya tidak bisa login lagi. Riwayat kunjungan yang pernah dicatat tetap tersimpan.`)) return;
    setDeletingId(acc.id);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/delete-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token}` },
        body: JSON.stringify({ adminId: acc.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert('Gagal menghapus admin: ' + (result.error || `HTTP ${response.status}`));
      } else {
        await loadAdmins();
      }
    } catch (err) {
      alert('Gagal menghapus admin: ' + err.message);
    }
    setDeletingId(null);
  };

  return (
    <div>
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Manajemen Akun & Aktivitas Login</h2>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="w-full py-3 px-4 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-100"
        >
          <UserPlus size={16} /> Undang Admin Baru
        </button>

        {invites.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Undangan menunggu login pertama</p>
            {invites.map((inv) => (
              <div key={inv.email} className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{inv.full_name}</p>
                  <p className="text-[11px] text-gray-500 font-mono truncate">{inv.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancelInvite(inv.email)}
                  className="shrink-0 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Batalkan
                </button>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Memuat daftar akun...</p>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Belum ada akun.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{acc.full_name}</p>
                    {acc.email && <p className="text-[11px] text-gray-500 font-mono truncate">{acc.email}</p>}
                  </div>
                  <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${acc.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {acc.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>

                <div className="text-[11px] text-gray-600 space-y-1">
                  <p className="flex items-center gap-1.5"><Clock size={12} className="shrink-0" /> Login terakhir: <b>{formatLastLogin(acc.last_login_at)}</b></p>
                  {acc.last_login_at && (
                    <>
                      <p className="flex items-center gap-1.5"><Smartphone size={12} className="shrink-0" /> {acc.last_login_device || 'Device tidak diketahui'}</p>
                      <p className="flex items-center gap-1.5"><MapPin size={12} className="shrink-0" /> {acc.last_login_location || 'Lokasi tidak diketahui'}{acc.last_login_ip ? ` (${acc.last_login_ip})` : ''}</p>
                    </>
                  )}
                </div>

                {acc.role === 'admin' && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Lock size={12} className="shrink-0" />
                      {acc.device_label ? `Terkunci: ${acc.device_label}` : 'Belum terkunci ke device manapun'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {acc.device_id && (
                        <button
                          type="button"
                          onClick={() => handleResetDevice(acc.id)}
                          disabled={resettingId === acc.id}
                          className="text-[11px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {resettingId === acc.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          Reset Device
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAdmin(acc)}
                        disabled={deletingId === acc.id}
                        className="text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {deletingId === acc.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Hapus
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 relative">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black text-gray-900 mb-4">Undang Admin Baru</h3>

            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-3">{formError}</div>
            )}

            <p className="text-[11px] text-gray-500 mb-3">Admin cukup menekan "Masuk dengan Google" memakai email ini. Akunnya dibuat otomatis saat login pertama, dan perangkat pertamanya terkunci.</p>
            <form onSubmit={handleInviteAdmin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nama Kasir</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Email Google</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all disabled:opacity-70"
              >
                {isSubmitting ? 'Menyimpan...' : 'Kirim Undangan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsPanel;
