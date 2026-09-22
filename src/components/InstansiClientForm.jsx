import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

// Tambah / edit satu klien instansi (B2B). `client` diisi kalau mode edit, kosong kalau tambah baru.
const InstansiClientForm = ({ client, packages = [], onClose, onSave }) => {
  const [form, setForm] = useState({
    clientCode: client?.client_code || '',
    institutionName: client?.institution_name || '',
    email: client?.email || '',
    servicePackage: client?.service_package || packages[0]?.name || '',
    address: client?.address || '',
    status: client?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientCode.trim() || !form.institutionName.trim()) {
      setError('Kode klien dan nama instansi wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan klien.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
          <X size={18} />
        </button>
        <h3 className="text-lg font-black text-gray-900">{client ? 'Edit Klien' : 'Tambah Klien'}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Kode Klien</label>
            <input value={form.clientCode} onChange={set('clientCode')} type="text" placeholder="Misal: SDN01" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Status</label>
            <select value={form.status} onChange={set('status')} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama Instansi</label>
          <input value={form.institutionName} onChange={set('institutionName')} type="text" placeholder="Misal: SD Negeri 05 Teras Terunjam" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Email</label>
          <input value={form.email} onChange={set('email')} type="email" placeholder="email@instansi.go.id" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Paket Layanan</label>
          {packages.length > 0 ? (
            <select value={form.servicePackage} onChange={set('servicePackage')} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
              {packages.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          ) : (
            <input value={form.servicePackage} onChange={set('servicePackage')} type="text" placeholder="Misal: NET.SI 50 Mbps" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Alamat</label>
          <textarea value={form.address} onChange={set('address')} rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
        </div>

        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

        <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-gray-900 hover:bg-black text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Menyimpan...' : client ? 'Simpan Perubahan' : 'Tambah Klien'}
        </button>
      </form>
    </div>
  );
};

export default InstansiClientForm;
