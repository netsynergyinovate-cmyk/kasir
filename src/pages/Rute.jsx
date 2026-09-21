import { useState, useEffect, useMemo } from 'react';
import { Navigation, MapPin, Phone, ClipboardPen, ChevronUp, ChevronDown, X, Plus, Settings2, Route as RouteIcon, CheckCircle2, Loader2 } from 'lucide-react';
import RouteMap from '../components/RouteMap';
import LocationPicker from '../components/LocationPicker';
import { customerVisitStatus, pendingStops, OUTCOME_LABELS, STATUS_COLORS } from '../utils/visits';
import { googleMapsNavUrl, googleMapsRouteUrl, formatDistance, formatDuration } from '../utils/geo';
import { fetchRoadRoute } from '../utils/routing';
import { toInputValue } from '../utils/dashboardStats';

const hasCoords = (customer) => typeof customer.lat === 'number' && typeof customer.lng === 'number';

const BADGE_CLASSES = {
  sudah_bayar: 'bg-emerald-100 text-emerald-700',
  menunggu: 'bg-amber-100 text-amber-700',
  perlu_didatangi: 'bg-red-100 text-red-700',
  belum_dikunjungi: 'bg-red-100 text-red-700',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${BADGE_CLASSES[status.key]}`}>
    {status.label}
  </span>
);

const NavButton = ({ customer, primary }) => (
  hasCoords(customer) ? (
    <a
      href={googleMapsNavUrl(customer)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all ${primary ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-indigo-50 text-indigo-700'}`}
    >
      <Navigation size={14} /> Navigasi
    </a>
  ) : (
    <span className="flex-1 text-center py-2.5 rounded-xl text-[11px] font-bold bg-gray-100 text-gray-400">Koordinat belum diisi</span>
  )
);

const Rute = ({ customers = [], transactions = [], visits = [], role, onAddVisit, onUpdateCustomerRoute }) => {
  const isSuper = role === 'superadmin';
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [visitFor, setVisitFor] = useState(null);
  const [visitOutcome, setVisitOutcome] = useState('tidak_ada_di_rumah');
  const [visitDate, setVisitDate] = useState('');
  const [visitSaving, setVisitSaving] = useState(false);
  const [coordFor, setCoordFor] = useState(null);
  const [coordDraft, setCoordDraft] = useState(null);
  const [roadRoute, setRoadRoute] = useState({ key: '', data: null });

  const now = new Date();
  const today = toInputValue(now);

  const routeCustomers = useMemo(
    () => customers
      .filter((customer) => customer.route_order !== null && customer.route_order !== undefined)
      .sort((a, b) => a.route_order - b.route_order),
    [customers],
  );
  const notInRoute = customers.filter((customer) => customer.route_order === null || customer.route_order === undefined);

  const statusById = useMemo(() => {
    const map = {};
    customers.forEach((customer) => {
      map[customer.id] = customerVisitStatus(customer, visits, transactions);
    });
    return map;
  }, [customers, visits, transactions]);

  const pending = pendingStops(routeCustomers, statusById);
  const nextStop = pending[0] || null;
  const afterNext = pending[1] || null;
  const paidCount = routeCustomers.filter((customer) => statusById[customer.id]?.key === 'sudah_bayar').length;

  const mappedStops = useMemo(
    () => routeCustomers
      .map((customer, index) => ({ customer, number: index + 1 }))
      .filter(({ customer }) => hasCoords(customer)),
    [routeCustomers],
  );

  const routeKey = mappedStops.map(({ customer }) => `${customer.lat},${customer.lng}`).join('|');

  useEffect(() => {
    if (mappedStops.length < 2) return undefined;
    let cancelled = false;
    fetchRoadRoute(mappedStops.map(({ customer }) => ({ lat: customer.lat, lng: customer.lng }))).then((data) => {
      if (!cancelled) setRoadRoute({ key: routeKey, data });
    });
    return () => { cancelled = true; };
    // routeKey mewakili isi mappedStops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const roadReady = roadRoute.key === routeKey;
  const route = roadReady ? roadRoute.data : null;
  const routeLoading = mappedStops.length >= 2 && !roadReady;

  const legBefore = {};
  if (route) {
    mappedStops.forEach(({ customer }, index) => {
      if (index > 0 && route.legs[index - 1]) legBefore[customer.id] = route.legs[index - 1];
    });
  }

  const mapStops = useMemo(
    () => mappedStops.map(({ customer, number }) => ({
      id: customer.id,
      lat: customer.lat,
      lng: customer.lng,
      number,
      statusKey: statusById[customer.id]?.key,
      title: customer.name,
    })),
    [mappedStops, statusById],
  );

  const openVisit = (customer) => {
    setVisitFor(customer);
    setVisitOutcome('tidak_ada_di_rumah');
    setVisitDate('');
  };

  const saveVisit = async (event) => {
    event.preventDefault();
    setVisitSaving(true);
    const ok = await onAddVisit({ customer_id: visitFor.id, outcome: visitOutcome, available_on: visitDate });
    setVisitSaving(false);
    if (ok) setVisitFor(null);
  };

  const openCoords = (customer) => {
    setCoordFor(customer);
    setCoordDraft(hasCoords(customer) ? { lat: customer.lat, lng: customer.lng } : null);
  };

  const saveCoords = async () => {
    if (!coordDraft) return;
    await onUpdateCustomerRoute(coordFor.id, { lat: coordDraft.lat, lng: coordDraft.lng });
    setCoordFor(null);
  };

  const move = async (index, direction) => {
    const a = routeCustomers[index];
    const b = routeCustomers[index + direction];
    if (!a || !b) return;
    await Promise.all([
      onUpdateCustomerRoute(a.id, { route_order: b.route_order }),
      onUpdateCustomerRoute(b.id, { route_order: a.route_order }),
    ]);
  };

  const addToRoute = (customer) => {
    const nextOrder = routeCustomers.length > 0 ? Math.max(...routeCustomers.map((c) => c.route_order)) + 1 : 1;
    return onUpdateCustomerRoute(customer.id, { route_order: nextOrder });
  };

  const remainingWithCoords = pending.filter(hasCoords).map((customer) => ({ lat: customer.lat, lng: customer.lng }));

  return (
    <div className="p-4 space-y-5 pb-32 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><RouteIcon size={20} className="text-indigo-600" /> Rute Kunjungan</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            {routeCustomers.length} rumah · {pending.length} perlu didatangi · {paidCount} sudah bayar
          </p>
        </div>
        {isSuper && (
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${editMode ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
          >
            <Settings2 size={14} /> {editMode ? 'Selesai' : 'Atur Rute'}
          </button>
        )}
      </div>

      {/* Tujuan berikutnya */}
      {routeCustomers.length === 0 ? (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 text-center text-xs text-gray-500">
          Belum ada rumah di rute. {isSuper ? 'Klik "Atur Rute" lalu tambahkan pelanggan.' : 'Superadmin belum menyusun rute.'}
        </div>
      ) : nextStop ? (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Tujuan berikutnya · {pending.length} rumah tersisa</p>
          <div>
            <h2 className="text-lg font-black leading-tight">{nextStop.name}</h2>
            <p className="text-xs text-indigo-100 mt-0.5 flex items-start gap-1"><MapPin size={13} className="shrink-0 mt-0.5" /> {nextStop.address || 'Alamat belum diisi'}</p>
            <div className="mt-2"><StatusBadge status={statusById[nextStop.id]} /></div>
          </div>
          <div className="flex gap-2">
            <NavButton customer={nextStop} primary />
            <button
              type="button"
              onClick={() => openVisit(nextStop)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 active:scale-95 transition-all"
            >
              <ClipboardPen size={14} /> Catat Kunjungan
            </button>
          </div>
          {afterNext && (
            <p className="text-[11px] text-indigo-100 border-t border-white/20 pt-2">
              Setelah ini: <b>{afterNext.name}</b>{legBefore[afterNext.id] ? ` · ${formatDistance(legBefore[afterNext.id].distance)} (${formatDuration(legBefore[afterNext.id].duration)})` : ''}
            </p>
          )}
          {remainingWithCoords.length > 1 && (
            <a
              href={googleMapsRouteUrl(remainingWithCoords)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[11px] font-bold text-white/90 underline"
            >
              Buka semua sisa rute di Google Maps
            </a>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 shrink-0" size={24} />
          <p className="text-sm font-bold text-emerald-800">Semua rumah di rute sudah beres atau menunggu tanggal janji.</p>
        </div>
      )}

      {/* Peta */}
      {mapStops.length > 0 && (
        <div className="space-y-2">
          <RouteMap stops={mapStops} routeLine={route?.coordinates || null} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-gray-500 px-1">
            {[['perlu_didatangi', 'Perlu didatangi'], ['menunggu', 'Menunggu janji'], ['sudah_bayar', 'Sudah bayar']].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[key] }} /> {label}</span>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 px-1 flex items-center gap-1.5">
            {routeLoading && <><Loader2 size={12} className="animate-spin" /> Menghitung jalur jalan...</>}
            {route && <>Jalur jalan seluruh rute: <b>{formatDistance(route.distance)}</b> · sekitar <b>{formatDuration(route.duration)}</b> berkendara</>}
            {!routeLoading && !route && mappedStops.length >= 2 && <>Jalur jalan tidak tersedia saat ini, ditampilkan garis lurus.</>}
          </p>
        </div>
      )}

      {/* Daftar rute */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Urutan Kunjungan</h2>
        {routeCustomers.map((customer, index) => {
          const status = statusById[customer.id];
          const leg = legBefore[customer.id];
          const isNext = nextStop && nextStop.id === customer.id;
          return (
            <div
              key={customer.id}
              onClick={() => setSelectedId(customer.id)}
              className={`bg-white p-3.5 rounded-2xl border shadow-sm space-y-2.5 ${isNext ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'} ${selectedId === customer.id ? 'bg-indigo-50/40' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0" style={{ background: STATUS_COLORS[status.key] }}>{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-900 truncate">{customer.name}</p>
                  <p className="text-[11px] text-gray-500 flex items-start gap-1"><MapPin size={11} className="shrink-0 mt-0.5" /> {customer.address || 'Alamat belum diisi'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge status={status} />
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-bold text-indigo-600 flex items-center gap-1"><Phone size={11} /> {customer.phone}</a>
                    )}
                  </div>
                  {leg && <p className="text-[10px] text-gray-400 mt-1">Dari rumah sebelumnya: {formatDistance(leg.distance)} · {formatDuration(leg.duration)}</p>}
                </div>
              </div>

              {status.key !== 'sudah_bayar' && (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <NavButton customer={customer} />
                  <button type="button" onClick={() => openVisit(customer)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 active:scale-95 transition-all">
                    <ClipboardPen size={14} /> Catat Kunjungan
                  </button>
                </div>
              )}

              {isSuper && editMode && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="p-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button type="button" disabled={index === routeCustomers.length - 1} onClick={() => move(index, 1)} className="p-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30"><ChevronDown size={16} /></button>
                  <button type="button" onClick={() => openCoords(customer)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700"><MapPin size={13} /> {hasCoords(customer) ? 'Ubah koordinat' : 'Isi koordinat'}</button>
                  <button type="button" onClick={() => onUpdateCustomerRoute(customer.id, { route_order: null })} className="p-2 rounded-lg bg-red-50 text-red-500" title="Keluarkan dari rute"><X size={16} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pelanggan di luar rute (superadmin) */}
      {isSuper && editMode && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Belum Masuk Rute ({notInRoute.length})</h2>
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {notInRoute.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-gray-100">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{customer.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{customer.address || 'Alamat belum diisi'}</p>
                </div>
                <button type="button" onClick={() => addToRoute(customer)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white"><Plus size={13} /> Tambah</button>
              </div>
            ))}
            {notInRoute.length === 0 && <p className="text-xs text-gray-400 italic text-center py-3">Semua pelanggan sudah masuk rute.</p>}
          </div>
        </div>
      )}

      {/* Modal catat kunjungan */}
      {visitFor && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <form onSubmit={saveVisit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4 relative">
            <button type="button" onClick={() => setVisitFor(null)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"><X size={18} /></button>
            <div>
              <h3 className="text-lg font-black text-gray-900">Catat Kunjungan</h3>
              <p className="text-xs text-gray-500">{visitFor.name}</p>
            </div>

            <div className="space-y-2">
              {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                <label key={value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${visitOutcome === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                  <input type="radio" name="outcome" value={value} checked={visitOutcome === value} onChange={() => setVisitOutcome(value)} />
                  <span className="text-sm font-bold text-gray-800">{label}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                {visitOutcome === 'uang_belum_ada' ? 'Kapan uangnya ada?' : 'Kapan ada di rumah?'}
              </label>
              <input
                type="date"
                required
                min={today}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold focus:border-indigo-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">Rumah ini tidak muncul lagi sebagai tujuan sampai tanggal itu tiba.</p>
            </div>

            <button type="submit" disabled={visitSaving} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl disabled:opacity-70">
              {visitSaving ? 'Menyimpan...' : 'Simpan Kunjungan'}
            </button>
          </form>
        </div>
      )}

      {/* Modal koordinat (superadmin) */}
      {coordFor && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4 relative max-h-[92vh] overflow-y-auto">
            <button type="button" onClick={() => setCoordFor(null)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"><X size={18} /></button>
            <div>
              <h3 className="text-lg font-black text-gray-900">Koordinat Rumah</h3>
              <p className="text-xs text-gray-500">{coordFor.name} · {coordFor.address || 'Alamat belum diisi'}</p>
            </div>
            <LocationPicker
              value={coordDraft}
              onChange={setCoordDraft}
              otherPoints={routeCustomers.filter((c) => hasCoords(c) && c.id !== coordFor.id).map((c) => ({ lat: c.lat, lng: c.lng }))}
            />
            <button type="button" disabled={!coordDraft} onClick={saveCoords} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl disabled:opacity-50">
              Simpan Koordinat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rute;
