import { useState } from 'react';
import { X } from 'lucide-react';
import { nextSevenDays, buildVisitPayload } from '../utils/visits';

const OPTIONS = [
  ['tidak_ada_di_rumah', 'Tidak ada di rumah'],
  ['uang_belum_ada', 'Ada di rumah, uang belum ada'],
];

// Form "Catat Kunjungan". Dipakai halaman Rute (superadmin) dan kartu rute di Dashboard (admin).
//  - Tidak ada di rumah: dicatat untuk hari itu saja, tanpa pilih tanggal (besok rumah muncul lagi).
//  - Ada di rumah, uang belum ada: pilih hari bayarnya dari 7 hari ke depan.
// Kalau sudah dibayar lewat Kasir, statusnya otomatis menjadi Sudah terbayarkan (hijau).
// onSave menerima { customer_id, outcome, available_on } dan mengembalikan true jika berhasil.
const VisitModal = ({ customer, onClose, onSave, initialOutcome = 'tidak_ada_di_rumah' }) => {
  const [outcome, setOutcome] = useState(initialOutcome);
  const days = nextSevenDays(new Date());
  const [date, setDate] = useState(days[0].value);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave(buildVisitPayload(customer.id, outcome, date));
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
          {OPTIONS.map(([value, label]) => (
            <label key={value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${outcome === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
              <input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
              <span className="text-sm font-bold text-gray-800">{label}</span>
            </label>
          ))}
        </div>

        {outcome === 'uang_belum_ada' ? (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Kapan uangnya ada?</label>
            <div className="grid grid-cols-4 gap-1.5">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  data-day-chip
                  onClick={() => setDate(day.value)}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${date === day.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Rumah ini muncul lagi sebagai tujuan pada hari yang dipilih. Jika sudah dibayar lewat Kasir, statusnya otomatis menjadi Sudah terbayarkan.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
            Dicatat untuk hari ini. Besok rumah ini muncul lagi sebagai tujuan. Saat didatangi lagi, catat hasil terbarunya (dibayar lewat Kasir, atau pilih uang belum ada dan hari bayarnya).
          </p>
        )}

        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl disabled:opacity-70">
          {saving ? 'Menyimpan...' : 'Simpan Kunjungan'}
        </button>
      </form>
    </div>
  );
};

export default VisitModal;
