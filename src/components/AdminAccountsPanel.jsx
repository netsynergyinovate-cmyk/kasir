import { useState, useEffect } from 'react';
import { UserPlus, RotateCcw, Smartphone, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AdminAccountsPanel = ({ session }) => {
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const loadAdmins = async () => {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('id, full_name, device_id, device_label, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (!error && data) setAdmins(data);
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('admin_profiles')
      .select('id, full_name, device_id, device_label, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setAdmins(data);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: formEmail, password: formPassword, fullName: formName }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal membuat akun admin.');
      }

      setShowCreateModal(false);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      await loadAdmins();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
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

  return (
    <div>
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Manajemen Akun</h2>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="w-full py-3 px-4 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-100"
        >
          <UserPlus size={16} /> Buat Admin Baru
        </button>

        {isLoading ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Memuat daftar admin...</p>
        ) : admins.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Belum ada akun admin.</p>
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">{admin.full_name}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Smartphone size={12} />
                    {admin.device_label ? admin.device_label : 'Belum terkunci ke device manapun'}
                  </p>
                </div>
                {admin.device_id && (
                  <button
                    type="button"
                    onClick={() => handleResetDevice(admin.id)}
                    disabled={resettingId === admin.id}
                    className="text-[11px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {resettingId === admin.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Reset Device
                  </button>
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
            <h3 className="text-lg font-black text-gray-900 mb-4">Buat Admin Baru</h3>

            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-3">{formError}</div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-3">
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
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all disabled:opacity-70"
              >
                {isSubmitting ? 'Membuat...' : 'Buat Akun'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsPanel;
