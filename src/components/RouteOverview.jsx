import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, MapPin, Route as RouteIcon, CheckCircle2, Loader2, LocateFixed } from 'lucide-react';
import RouteMap from './RouteMap';
import VisitModal from './VisitModal';
import StatusBadge from './StatusBadge';
import StatusLegend from './StatusLegend';
import { useRouteData, hasCoords } from '../hooks/useRouteData';
import { googleMapsNavUrl, formatDistance, formatDuration } from '../utils/geo';
import { TONE_COLORS } from '../utils/visits';
import { describeLocationAge, locationAdvice, accuracyLevel } from '../utils/location';

const NOTE_CLASSES = {
  ok: 'text-emerald-700 bg-emerald-50',
  info: 'text-gray-600 bg-gray-50',
  warn: 'text-amber-800 bg-amber-50',
};

// Kartu rute di Dashboard: peta satelit + jalur jalan + tujuan berikutnya + catatan kunjungan.
// Untuk admin ini menggantikan halaman Rute terpisah; superadmin mengatur rute di halaman Rute.
//  - origin / myPosition / locationStatus: posisi admin (jalur dimulai dari sana).
//  - adminLocations: posisi semua admin, hanya untuk superadmin.
const RouteOverview = ({
  customers = [], transactions = [], visits = [], onAddVisit, canManageRoute = false,
  origin = null, myPosition = null, locationStatus = 'off', adminLocations = [], onRetryLocation,
}) => {
  const [visitFor, setVisitFor] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState('');
  const savedTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  // Dashboard ringkas: rumah yang infonya sudah diisi (menunggu janji / sudah bayar) disembunyikan,
  // hanya yang masih perlu didatangi yang tampil di peta dan daftar.
  const {
    routeCustomers, statusById, pending, nextStop, afterNext, paidCount, waitingCount,
    mapStops, route, routeLoading, legBefore, routeNumberById, hasOrigin,
  } = useRouteData({ customers, transactions, visits, onlyPending: true, origin });

  const people = useMemo(() => {
    const list = [];
    if (myPosition) list.push({ id: 'me', lat: myPosition.lat, lng: myPosition.lng, accuracy: myPosition.accuracy, title: 'Posisi Anda', self: true });
    adminLocations.forEach((admin) => {
      const age = describeLocationAge(admin.updatedAt);
      list.push({ id: admin.id, lat: admin.lat, lng: admin.lng, accuracy: admin.accuracy, title: `${admin.name} · ${age.label}`, stale: age.stale });
    });
    return list;
  }, [myPosition, adminLocations]);

  // Setelah info kunjungan tersimpan, rumah itu hilang dari daftar dan jalur/tujuan pindah ke rumah berikutnya.
  const handleSave = async (payload) => {
    const ok = await onAddVisit(payload);
    if (ok) {
      setJustSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 10000);
    }
    return ok;
  };

  // Tanggal tagihan yang benar-benar dipakai pelanggan di rute ini, buat opsi filter.
  const dueDateOptions = useMemo(() => {
    const set = new Set();
    customers.forEach((customer) => {
      if (customer.due_date !== null && customer.due_date !== undefined && customer.due_date !== '') {
        set.add(String(customer.due_date));
      }
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [customers]);
  const displayedPending = dueDateFilter
    ? pending.filter((customer) => String(customer.due_date) === dueDateFilter)
    : pending;

  const locationNote = locationAdvice(locationStatus);
  const accuracy = locationStatus === 'active' && myPosition ? accuracyLevel(myPosition.accuracy) : null;
  const legToNext = nextStop ? legBefore[nextStop.id] : null;
  const showMap = mapStops.length > 0 || people.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 ml-1">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
          <RouteIcon size={12} /> Rute Kunjungan
        </h2>
        {canManageRoute && <Link to="/rute" className="text-[10px] text-blue-600 font-bold hover:underline mr-1">Atur Rute</Link>}
      </div>

      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        {justSaved && (
          <div className="bg-emerald-600 text-white p-3 rounded-xl flex items-center gap-2.5">
            <CheckCircle2 size={18} className="shrink-0" />
            <p className="text-xs font-bold">
              Info kunjungan tersimpan.{' '}
              {nextStop ? <>Rute diperbarui menuju <b>{nextStop.name}</b>.</> : 'Semua rumah sudah beres.'}
            </p>
          </div>
        )}

        {locationNote && (
          <div className={`text-[11px] font-semibold rounded-xl px-3 py-2 space-y-2 ${NOTE_CLASSES[locationNote.tone]}`}>
            <p className="flex items-start gap-1.5"><LocateFixed size={13} className="shrink-0 mt-0.5" /> {locationNote.text}</p>
            {accuracy && (
              <p className={accuracy.level === 'poor' ? 'text-amber-800' : ''}>
                {accuracy.label}{accuracy.hint ? `. ${accuracy.hint}` : ''}
              </p>
            )}
            {locationNote.canRetry && onRetryLocation && (
              <button type="button" onClick={onRetryLocation} className="w-full py-2 rounded-lg bg-white/80 text-[11px] font-black text-indigo-700 active:scale-95 transition-all">
                Aktifkan lokasi
              </button>
            )}
          </div>
        )}

        {routeCustomers.length === 0 && people.length === 0 ? (
          <div className="text-center py-4 space-y-1">
            <MapPin className="mx-auto text-gray-300" size={26} />
            <p className="text-xs font-bold text-gray-700">Belum ada rute kunjungan.</p>
            <p className="text-[11px] text-gray-500">Superadmin belum menyusun rute rumah pelanggan.</p>
          </div>
        ) : (
          <>
            {showMap ? (
              <>
                <RouteMap compact stops={mapStops} routeLine={route?.coordinates || null} people={people} />
                <StatusLegend />
              </>
            ) : pending.length > 0 ? (
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <MapPin className="mx-auto text-indigo-400" size={22} />
                <p className="text-xs font-bold text-indigo-900 mt-1">Peta muncul setelah koordinat rumah diisi.</p>
                <p className="text-[11px] text-indigo-700">Minta superadmin mengisi koordinat rumah pelanggan.</p>
              </div>
            ) : null}

            {routeCustomers.length > 0 && (
              <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
                <span><b>{pending.length}</b> perlu didatangi · <b>{waitingCount}</b> menunggu janji · <b>{paidCount}</b> sudah terbayarkan</span>
                {routeLoading && <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> menghitung jalur...</span>}
                {route && <span>· jalur {formatDistance(route.distance)} (~{formatDuration(route.duration)})</span>}
              </p>
            )}

            {routeCustomers.length > 0 && (nextStop ? (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-3.5 rounded-xl space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Tujuan berikutnya</p>
                <div>
                  <p className="text-base font-black leading-tight">{nextStop.name}</p>
                  <p className="text-[11px] text-indigo-100 mt-0.5 flex items-start gap-1"><MapPin size={12} className="shrink-0 mt-0.5" /> {nextStop.address || 'Alamat belum diisi'}</p>
                  <p className="text-[11px] text-indigo-100 mt-1">{statusById[nextStop.id]?.label}</p>
                  {hasOrigin && legToNext && (
                    <p className="text-[11px] font-bold text-white mt-1">Dari posisi Anda: {formatDistance(legToNext.distance)} · {formatDuration(legToNext.duration)}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {hasCoords(nextStop) ? (
                    <a
                      href={googleMapsNavUrl(nextStop)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-white text-indigo-700 active:scale-95 transition-all"
                    >
                      <Navigation size={14} /> Navigasi
                    </a>
                  ) : (
                    <span className="flex-1 text-center py-2.5 rounded-xl text-[11px] font-bold bg-white/15">Koordinat belum diisi</span>
                  )}
                  <button type="button" onClick={() => setVisitFor(nextStop)} className="flex-1 flex items-center justify-center py-2.5 rounded-xl text-xs font-bold bg-white/15 active:scale-95 transition-all">
                    Catat Kunjungan
                  </button>
                </div>
                {afterNext && <p className="text-[11px] text-indigo-100">Setelah ini: <b>{afterNext.name}</b></p>}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2.5">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                <p className="text-xs font-bold text-emerald-800">Semua rumah di rute sudah beres atau menunggu tanggal janji.</p>
              </div>
            ))}

            {pending.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Urutan kunjungan</p>
                  {dueDateOptions.length > 0 && (
                    <select
                      value={dueDateFilter}
                      onChange={(e) => setDueDateFilter(e.target.value)}
                      className="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-1 outline-none"
                    >
                      <option value="">Semua tanggal</option>
                      {dueDateOptions.map((day) => (
                        <option key={day} value={day}>Tgl {day}</option>
                      ))}
                    </select>
                  )}
                </div>
                {displayedPending.length === 0 && (
                  <p className="text-[11px] text-gray-400 italic text-center py-3">Tidak ada pelanggan dengan tanggal tagihan ini.</p>
                )}
                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {displayedPending.map((customer) => {
                    const status = statusById[customer.id];
                    const leg = legBefore[customer.id];
                    const fromMe = hasOrigin && mapStops[0]?.id === customer.id;
                    return (
                      <div key={customer.id} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                        <div className="w-7 h-7 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0" style={{ background: TONE_COLORS[status.tone] }}>{routeNumberById[customer.id]}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-gray-900 truncate">{customer.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{customer.address || 'Alamat belum diisi'}</p>
                          <div className="mt-1"><StatusBadge status={status} /></div>
                          {leg && <p className="text-[10px] text-gray-400 mt-1">{fromMe ? 'Dari posisi Anda' : 'Dari rumah sebelumnya'}: {formatDistance(leg.distance)} · {formatDuration(leg.duration)}</p>}
                        </div>
                        {status.key !== 'sudah_bayar' && onAddVisit && (
                          <button type="button" onClick={() => setVisitFor(customer)} className="shrink-0 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg">
                            Catat
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {visitFor && onAddVisit && <VisitModal customer={visitFor} onClose={() => setVisitFor(null)} onSave={handleSave} />}
    </div>
  );
};

export default RouteOverview;
