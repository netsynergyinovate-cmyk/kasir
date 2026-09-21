import { useState } from 'react';
import { X } from 'lucide-react';
import { OUTCOME_LABELS } from '../utils/visits';
import { toInputValue } from '../utils/dashboardStats';

// Form "Catat Kunjungan": hasil kunjungan + tanggal kapan ada. Dipakai halaman Rute (superadmin)
// dan kartu rute di Dashboard (admin). onSave menerima { customer_id, outcome, available_on }
// dan mengembalikan true jika berhasil disimpan.
const VisitModal = ({ customer, onClose, onSave }) => {
  const [outcome, setOutcome] = useState('tidak_ada_di_rumah');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const today = toInputValue(new Date());

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({ customer_id: customer.id, outcome, available_on: date });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"><X size={18} /></button>
        <div>
          <h3 className="text-lg font-black text-gray-900">Catat Kunjungan</h3>
          <p className="text-xs text-gray-500">{customer.name}</p>
        </div>

        <div className="space-y-2">
          {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
            <label key={value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${outcome === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
              <input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
              <span className="text-sm font-bold text-gray-800">{label}</span>
            </label>
          ))}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
            {outcome === 'uang_belum_ada' ? 'Kapan uangnya ada?' : 'Kapan ada di rumah?'}
          </label>
          <input
            type="date"
            required
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold focus:border-indigo-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">Rumah ini tidak muncul lagi sebagai tujuan sampai tanggal itu tiba.</p>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl disabled:opacity-70">
          {saving ? 'Menyimpan...' : 'Simpan Kunjungan'}
        </button>
      </form>
    </div>
  );
};

export default VisitModal;
