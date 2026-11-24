import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, MapPin, Play, Flag, Loader2, LocateFixed, Lock, Clock, Wallet } from 'lucide-react';
import RouteMap from '../components/RouteMap';
import { supabase } from '../lib/supabase';
import { customerVisitStatus, nextSevenDays, buildVisitPayload, formatShortDate } from '../utils/visits';
import { fetchRoadRoute } from '../utils/routing';
import { distanceMeters, formatDistance, formatDuration, googleMapsNavUrl } from '../utils/geo';
import { locationAdvice } from '../utils/location';
import { toInputValue } from '../utils/dashboardStats';
import { readWork, writeWork, pickNextTarget, hasArrived, WORK_EVENT_LABELS, ARRIVE_METERS } from '../utils/startOnWork';

const PENDING_KEYS = ['belum_dikunjungi', 'perlu_didatangi'];
const timeOf = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

// Laporan wajib saat admin tiba di rumah pelanggan. Sebelum terkirim, halaman Transaksi dikunci (App.jsx).
const ArrivalSheet = ({ customer, canPayDirect, onReport }) => {
  const days = nextSevenDays(new Date());
  const [outcome, setOutcome] = useState('tidak_ada_di_rumah');
  const [date, setDate] = useState(days[0].value);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const options = [
    ['tidak_ada_di_rumah', 'Tidak ada di rumah'],
    ['uang_belum_ada', 'Ada di rumah, bayar nanti'],
    ['lainnya', 'Lainnya'],
    ...(canPayDirect ? [['bayar_langsung', 'Ada di rumah, bayar sekarang']] : []),
  ];

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onReport(outcome, { availableOn: date, note: note.trim() || null });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end justify-center p-4 animate-backdrop">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4 animate-sheet-up">
        <div>
          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><MapPin size={13} /> Anda sudah sampai</p>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{customer.name}</h3>
          <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5"><Lock size={11} /> Pembayaran lain dikunci sampai laporan ini dikirim.</p>
        </div>

        <div className="space-y-2">
          {options.map(([value, label]) => (
            <label key={value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${outcome === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
              <input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
              <span className="text-sm font-semibold text-gray-800">{label}</span>
            </label>
          ))}
        </div>

        {outcome === 'uang_belum_ada' && (
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1">Bayarnya kapan?</p>
            <div className="grid grid-cols-4 gap-1.5">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setDate(day.value)}
                  className={`py-2 rounded-xl text-[11px] font-semibold border ${date === day.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {outcome === 'lainnya' && (
          <textarea
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tulis keterangan, mis. rumah kosong pindah, minta putus, dll."
            className="w-full text-sm border border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500"
            rows={3}
          />
        )}

        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-70">
          {saving ? 'Mengirim...' : outcome === 'bayar_langsung' ? 'Lanjut ke Pembayaran' : 'Kirim Laporan'}
        </button>
      </form>
    </div>
  );
};

// Start On Work: admin tekan "Mari Mulai", rute otomatis dari posisinya ke rumah pelanggan berikutnya,
// tiba (radius ARRIVE_METERS) -> wajib lapor, lalu otomatis menuju rumah berikutnya. Semua langkah dicatat
// di work_logs. Superadmin hanya memantau log semua admin.
const StartOnWork = ({
  session, customers = [], transactions = [], visits = [], position = null, routeOrigin = null,
  locationStatus = 'off', onRetryLocation, onAddVisit, canPayDirect = false,
}) => {
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const isSuper = session?.profile?.role === 'superadmin';
  const adminName = session?.profile?.full_name || null;

  const [work, setWork] = useState(() => readWork(userId));
  const updateWork = useCallback((next) => { writeWork(next); setWork(next); }, []);

  const [logDate, setLogDate] = useState(() => toInputValue(new Date()));
  const [logs, setLogs] = useState([]);
  const [logError, setLogError] = useState('');

  const positionRef = useRef(position);
  useEffect(() => { positionRef.current = position; }, [position]);

  const loadLogs = useCallback(async () => {
    const from = new Date(`${logDate}T00:00:00`);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const { data, error } = await supabase
      .from('work_logs')
      .select('*')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) setLogError(error.message);
    else { setLogError(''); setLogs(data || []); }
  }, [logDate]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch log, setState setelah await
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const logEvent = useCallback(async (event, sessionId, customer = null, note = null) => {
    const pos = positionRef.current;
    const { data, error } = await supabase.from('work_logs').insert({
      session_id: sessionId,
      admin_name: adminName,
      customer_id: customer?.id || null,
      customer_name: customer?.name || null,
      event,
      note,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
    }).select().single();
    if (error) { setLogError(error.message); return; }
    if (logDate === toInputValue(new Date())) setLogs((prev) => [data, ...prev]);
  }, [adminName, logDate]);

  // Rumah yang masih perlu didatangi: rute superadmin dulu (urut), sisanya (tanpa rute) dipilih terdekat.
  const { routeStops, otherStops, pendingIds } = useMemo(() => {
    const pending = customers.filter((customer) =>
      customer.status !== 'terminate' && PENDING_KEYS.includes(customerVisitStatus(customer, visits, transactions).key));
    const inRoute = (customer) => customer.route_order !== null && customer.route_order !== undefined;
    return {
      routeStops: pending.filter(inRoute).sort((a, b) => a.route_order - b.route_order),
      otherStops: pending.filter((customer) => !inRoute(customer)),
      pendingIds: new Set(pending.map((customer) => customer.id)),
    };
  }, [customers, visits, transactions]);

  const target = work?.targetId ? customers.find((customer) => customer.id === work.targetId) || null : null;
  const arrivedCustomer = work?.arrivedId ? customers.find((customer) => customer.id === work.arrivedId) || null : null;

  // Transisi otomatis yang dipicu GPS & data (sistem luar): pilih tujuan + log "berangkat", tiba + log "tiba",
  // atau lepas tujuan yang basi. stepRef mencegah log ganda saat effect terpanggil ulang.
  const stepRef = useRef('');
  useEffect(() => {
    if (!work || customers.length === 0) return;
    let next = null;
    let log = null;
    if (work.arrivedId) {
      // Pelanggan yang sedang dilapori sudah dihapus: lepas kunci supaya admin tidak tertahan.
      if (!customers.some((customer) => customer.id === work.arrivedId)) next = { ...work, arrivedId: null, targetId: null };
    } else if (work.targetId) {
      if (!pendingIds.has(work.targetId)) next = { ...work, targetId: null }; // sudah dibayar/dilapori admin lain
      else if (hasArrived(position, target)) { next = { ...work, arrivedId: target.id }; log = ['tiba', target]; }
    } else {
      const stop = pickNextTarget({ routeStops, otherStops, position, doneIds: work.doneIds });
      if (stop) { next = { ...work, targetId: stop.id }; log = ['berangkat', stop]; }
    }
    if (!next) return;
    const key = `${work.sessionId}:${next.targetId}:${next.arrivedId}:${next.doneIds.length}`;
    if (stepRef.current === key) return;
    stepRef.current = key;
    updateWork(next);
    if (log) logEvent(log[0], work.sessionId, log[1]);
  }, [work, customers, pendingIds, routeStops, otherStops, position, target, updateWork, logEvent]);

  // Jalur jalan dari posisi admin ke tujuan; dihitung ulang hanya saat admin bergeser > 150 m (routeOrigin).
  const [road, setRoad] = useState({ key: '', data: null });
  const routeKey = routeOrigin && target ? `${routeOrigin.lat},${routeOrigin.lng}>${target.id}` : '';
  useEffect(() => {
    if (!routeKey) return undefined;
    let cancelled = false;
    fetchRoadRoute([routeOrigin, { lat: target.lat, lng: target.lng }]).then((data) => {
      if (!cancelled) setRoad({ key: routeKey, data });
    });
    return () => { cancelled = true; };
    // routeKey mewakili routeOrigin + target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  const roadRoute = road.key === routeKey ? road.data : null;

  const start = async () => {
    const next = { userId, sessionId: crypto.randomUUID(), startedAt: new Date().toISOString(), targetId: null, arrivedId: null, doneIds: [] };
    updateWork(next);
    await logEvent('mulai', next.sessionId);
  };

  const finish = async () => {
    if (!window.confirm('Selesai kerja lapangan hari ini?')) return;
    await logEvent('selesai', work.sessionId, null, `${work.doneIds.length} rumah ditangani`);
    updateWork(null);
  };

  const report = async (outcome, { availableOn, note }) => {
    const customer = arrivedCustomer;
    if (outcome !== 'bayar_langsung') {
      const ok = await onAddVisit({ ...buildVisitPayload(customer.id, outcome, availableOn), note });
      if (!ok) return;
    }
    await logEvent(outcome, work.sessionId, customer, outcome === 'uang_belum_ada' ? `Janji bayar ${formatShortDate(availableOn)}` : note);
    updateWork({ ...work, arrivedId: null, targetId: null, doneIds: [...work.doneIds, customer.id] });
    if (outcome === 'bayar_langsung') navigate(`/pos?cust=${encodeURIComponent(customer.id)}`);
  };

  const people = position ? [{ id: 'me', lat: position.lat, lng: position.lng, accuracy: position.accuracy, title: 'Posisi Anda', self: true }] : [];
  const stops = target ? [{ id: target.id, lat: target.lat, lng: target.lng, number: work.doneIds.length + 1, tone: 'red', title: target.name }] : [];
  const routeLine = roadRoute?.coordinates || (position && target ? [[position.lat, position.lng], [target.lat, target.lng]] : null);
  const remaining = position && target ? distanceMeters(position, target) : null;
  const departedAt = target && logs.find((log) => log.event === 'berangkat' && log.customer_id === target.id && log.session_id === work.sessionId)?.created_at;
  const locationNote = locationAdvice(locationStatus);
  const pendingCount = routeStops.length + otherStops.length;

  return (
    <div className="p-4 space-y-4 pb-28 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Start On Work</h1>
        <p className="text-xs text-gray-500">{isSuper ? 'Pantau log kerja lapangan semua admin.' : 'Rute otomatis ke rumah pelanggan dari posisi Anda.'}</p>
      </div>

      {!isSuper && locationNote && locationNote.tone !== 'ok' && (
        <div className="text-[11px] font-semibold rounded-xl px-3 py-2 bg-amber-50 text-amber-800 space-y-2">
          <p className="flex items-start gap-1.5"><LocateFixed size={13} className="shrink-0 mt-0.5" /> {locationNote.text}</p>
          {locationNote.canRetry && onRetryLocation && (
            <button type="button" onClick={onRetryLocation} className="w-full py-2 rounded-lg bg-white text-indigo-700 font-semibold">Aktifkan lokasi</button>
          )}
        </div>
      )}

      {!isSuper && !work && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-5 space-y-4 text-center">
          <Navigation className="mx-auto" size={36} />
          <div>
            <p className="text-lg font-bold">Siap turun lapangan?</p>
            <p className="text-xs text-indigo-100 mt-1">{pendingCount} rumah perlu didatangi. Rute dibuat otomatis, dan saat tiba Anda wajib melapor sebelum bisa menerima pembayaran lain.</p>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={!position}
            className="w-full flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-60"
          >
            {position ? <><Play size={18} /> Mari Mulai</> : <><Loader2 size={18} className="animate-spin" /> Menunggu lokasi GPS...</>}
          </button>
        </div>
      )}

      {!isSuper && work && (
        <div className="space-y-3">
          {(people.length > 0 || stops.length > 0) && <RouteMap stops={stops} people={people} routeLine={routeLine} animated={Boolean(target)} />}

          {target ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-indigo-600">Menuju rumah ke-{work.doneIds.length + 1}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{target.name}</p>
                <p className="text-[11px] text-gray-500 flex items-start gap-1 mt-0.5"><MapPin size={12} className="shrink-0 mt-0.5" /> {target.address || 'Alamat belum diisi'}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-xl py-2">
                  <p className="text-[10px] text-gray-500">Jarak</p>
                  <p className="text-xs font-bold text-gray-900">{remaining !== null ? formatDistance(remaining) : '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl py-2">
                  <p className="text-[10px] text-gray-500">Perkiraan</p>
                  <p className="text-xs font-bold text-gray-900">{roadRoute ? formatDuration(roadRoute.duration) : '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl py-2">
                  <p className="text-[10px] text-gray-500">Berangkat</p>
                  <p className="text-xs font-bold text-gray-900">{departedAt ? timeOf(departedAt) : '-'}</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">Laporan muncul otomatis saat Anda dalam {ARRIVE_METERS} m dari rumah ini.</p>
              <a href={googleMapsNavUrl(target)} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700">
                <Navigation size={14} /> Buka di Google Maps
              </a>
            </div>
          ) : !work.arrivedId && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-sm font-bold text-emerald-800">Tidak ada rumah lagi yang perlu didatangi.</p>
              <p className="text-[11px] text-emerald-700">{work.doneIds.length} rumah ditangani di sesi ini.</p>
            </div>
          )}

          <button type="button" onClick={finish} disabled={Boolean(work.arrivedId)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white disabled:opacity-50">
            <Flag size={16} /> Selesai Kerja
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Clock size={15} /> Log Kerja</p>
          <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1" />
        </div>
        {logError && <p className="text-[11px] text-red-700 bg-red-50 rounded-lg p-2">Log gagal: {logError}. Pastikan supabase_start_on_work.sql sudah dijalankan.</p>}
        {logs.length === 0 && !logError && <p className="text-xs text-gray-400 italic text-center py-3">Belum ada log.</p>}
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 text-xs">
              <span className="font-semibold text-gray-500 w-11 shrink-0">{timeOf(log.created_at)}</span>
              <div className="min-w-0">
                <p className="text-gray-900">
                  {log.event === 'bayar_langsung' && <Wallet size={12} className="inline mr-1 text-emerald-600" />}
                  <b>{WORK_EVENT_LABELS[log.event] || log.event}</b>{log.customer_name ? ` ${log.customer_name}` : ''}
                </p>
                {(log.note || (isSuper && log.admin_name)) && (
                  <p className="text-[11px] text-gray-500">{[isSuper ? log.admin_name : null, log.note].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isSuper && arrivedCustomer && (
        <ArrivalSheet key={arrivedCustomer.id} customer={arrivedCustomer} canPayDirect={canPayDirect} onReport={report} />
      )}
    </div>
  );
};

export default StartOnWork;
