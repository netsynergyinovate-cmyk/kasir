import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Play, CalendarOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { hasPermission, normalizeAdminAccess } from '../utils/permissions';
import { readWork, writeWork, isWorkDay, WEEKDAY_LABELS } from '../utils/startOnWork';

// Satu-satunya tombol "Mari Mulai" Start On Work, di Beranda admin. Hanya muncul untuk admin ber-hak work.view
// dan hanya di hari kerja yang diatur superadmin. Halaman /start-on-work sendiri hanya penunjuk arah.
const StartWorkCard = ({ session, position = null }) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const profile = session?.profile;
  const userId = session?.user?.id;

  if (profile?.role !== 'admin' || !hasPermission(profile.role, 'work.view', profile.allowed_paths)) return null;

  const active = readWork(userId);
  if (active) {
    return (
      <button type="button" onClick={() => navigate('/start-on-work')} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-indigo-600 text-white text-left active:scale-95 transition-all">
        <Navigation size={22} className="shrink-0" />
        <span className="flex-1">
          <span className="block text-sm font-bold">Start On Work sedang berjalan</span>
          <span className="block text-[11px] text-indigo-100">Ketuk untuk membuka penunjuk arah.</span>
        </span>
      </button>
    );
  }

  if (!isWorkDay(profile.allowed_paths)) {
    const days = normalizeAdminAccess(profile.allowed_paths).work_days || [];
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
        <CalendarOff size={20} className="text-gray-400 shrink-0" />
        <p className="text-xs text-gray-600">
          Hari ini bukan hari kerja lapangan Anda.
          {days.length > 0 && <> Hari kerja: <b>{[...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((day) => WEEKDAY_LABELS[day]).join(', ')}</b>.</>}
        </p>
      </div>
    );
  }

  const start = async () => {
    setStarting(true);
    const work = { userId, sessionId: crypto.randomUUID(), startedAt: new Date().toISOString(), targetId: null, arrivedId: null, doneIds: [] };
    const { error } = await supabase.from('work_logs').insert({
      session_id: work.sessionId,
      admin_name: profile.full_name || null,
      event: 'mulai',
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
    });
    setStarting(false);
    if (error) {
      alert('Gagal memulai kerja: ' + error.message);
      return;
    }
    writeWork(work);
    navigate('/start-on-work');
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Navigation size={26} className="shrink-0" />
        <div>
          <p className="text-sm font-bold">Start On Work</p>
          <p className="text-[11px] text-indigo-100">Rute ke rumah pelanggan dibuat otomatis dari posisi Anda.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={start}
        disabled={!position || starting}
        className="w-full flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold py-3 rounded-xl active:scale-95 transition-all disabled:opacity-60"
      >
        {starting || !position
          ? <><Loader2 size={18} className="animate-spin" /> {starting ? 'Memulai...' : 'Menunggu lokasi GPS...'}</>
          : <><Play size={18} /> Mari Mulai</>}
      </button>
    </div>
  );
};

export default StartWorkCard;
