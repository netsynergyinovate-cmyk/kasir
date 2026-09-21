import { useState, useMemo } from 'react';
import { Navigation, MapPin, Phone, ClipboardPen, ChevronUp, ChevronDown, X, Plus, Settings2, Route as RouteIcon, CheckCircle2, Loader2, Search, LocateFixed } from 'lucide-react';
import RouteMap from '../components/RouteMap';
import LocationPicker from '../components/LocationPicker';
import { TONE_COLORS, searchCustomers, describeVisit } from '../utils/visits';
import StatusLegend from '../components/StatusLegend';
import VisitModal from '../components/VisitModal';
import StatusBadge from '../components/StatusBadge';
import { useRouteData, hasCoords } from '../hooks/useRouteData';
import { googleMapsNavUrl, googleMapsRouteUrl, formatDistance, formatDuration } from '../utils/geo';
import { describeLocationAge, accuracyLevel } from '../utils/location';

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

// defaultFilter: 'perlu' (hanya rumah yang perlu didatangi, sama seperti Dashboard) atau 'semua'.
const Rute = ({ customers = [], transactions = [], visits = [], role, onAddVisit, onUpdateCustomerRoute, defaultFilter = 'perlu', adminLocations = [] }) => {
  const isSuper = role === 'superadmin';
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [visitFor, setVisitFor] = useState(null);
  const [coordFor, setCoordFor] = useState(null);
  const [coordDraft, setCoordDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(defaultFilter);

  const {
    routeCustomers, statusById, pending, nextStop, afterNext, paidCount,
    mapStops, route, routeLoading, legBefore, routeNumberById,
  } = useRouteData({ customers, transactions, visits });
  const notInRoute = customers.filter((customer) => customer.route_order === null || customer.route_order === undefined);

  // Posisi admin (pelacakan) untuk superadmin: penanda di peta dan daftar di bawahnya.
  const people = useMemo(() => adminLocations.map((admin) => {
    const age = describeLocationAge(admin.updatedAt);
    return { id: admin.id, lat: admin.lat, lng: admin.lng, accuracy: admin.accuracy, title: `${admin.name} · ${age.label}`, stale: age.stale };
  }), [adminLocations]);

  // Mode Atur Rute selalu menampilkan semua rumah supaya urutan bisa disusun.
  const focusPending = filter === 'perlu' && !editMode;
  const listed = searchCustomers(focusPending ? pending : routeCustomers, query);
  const notInRouteListed = searchCustomers(notInRoute, query);
  const historyOf = (customerId) => visits
    .filter((visit) => visit.customer_id === customerId)
    .sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime());

  const openVisit = (customer) => setVisitFor(customer);

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
            {routeCustomers.length} rumah · {pending.length} perlu didatangi · {paidCount} sudah terbayarkan
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
        <div className="bg-white p-5 rounded-2xl border border-gray-100 text-center space-y-3">
          <p className="text-sm font-bold text-gray-800">Belum ada rumah di rute.</p>
          <p className="text-xs text-gray-500">
            {isSuper ? 'Tambahkan pelanggan ke rute, isi koordinat rumahnya, lalu peta dan jalur kunjungan akan muncul di sini.' : 'Superadmin belum menyusun rute.'}
          </p>
          {isSuper && (
            <button type="button" onClick={() => setEditMode(true)} className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-200">
              Mulai Atur Rute
            </button>
          )}
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
      {routeCustomers.length > 0 && mapStops.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-center space-y-2">
          <MapPin className="mx-auto text-indigo-500" size={22} />
          <p className="text-xs font-bold text-indigo-900">Peta muncul setelah koordinat rumah diisi.</p>
          {isSuper ? (
            <button type="button" onClick={() => setEditMode(true)} className="px-3 py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-lg">
              Atur Rute lalu Isi koordinat
            </button>
          ) : (
            <p className="text-[11px] text-indigo-700">Minta superadmin mengisi koordinat rumah pelanggan.</p>
          )}
        </div>
      )}
      {(mapStops.length > 0 || people.length > 0) && (
        <div className="space-y-2">
          <RouteMap stops={mapStops} routeLine={route?.coordinates || null} selectedId={selectedId} onSelect={setSelectedId} people={people} />
          <StatusLegend />
          <p className="text-[11px] text-gray-500 px-1 flex items-center gap-1.5">
            {routeLoading && <><Loader2 size={12} className="animate-spin" /> Menghitung jalur jalan...</>}
            {route && <>Jalur jalan seluruh rute: <b>{formatDistance(route.distance)}</b> · sekitar <b>{formatDuration(route.duration)}</b> berkendara</>}
            {!routeLoading && !route && mapStops.length >= 2 && <>Jalur jalan tidak tersedia saat ini, ditampilkan garis lurus.</>}
          </p>
        </div>
      )}

      {/* Posisi admin (pelacakan) */}
      {isSuper && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5"><LocateFixed size={12} /> Posisi Admin</h2>
          {adminLocations.length === 0 ? (
            <p className="text-xs text-gray-400 italic bg-white border border-gray-100 rounded-xl p-3">Belum ada admin yang membagikan lokasi. Posisi muncul saat admin membuka aplikasi dan mengizinkan lokasi.</p>
          ) : (
            adminLocations.map((admin) => {
              const age = describeLocationAge(admin.updatedAt);
              return (
                <div key={admin.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-gray-900 truncate">{admin.name}</p>
                    <p className={`text-[11px] font-bold ${age.stale ? 'text-gray-400' : 'text-emerald-600'}`}>
                      {age.stale ? `Tidak aktif · terakhir ${age.label}` : `Aktif · ${age.label}`}
                    </p>
                    {admin.accuracy !== null && admin.accuracy !== undefined && (
                      <p className="text-[10px] text-gray-400">{accuracyLevel(admin.accuracy).label}</p>
                    )}
                  </div>
                  <a
                    href={googleMapsNavUrl({ lat: admin.lat, lng: admin.lng })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg"
                  >
                    Buka di Google Maps
                  </a>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pencarian dan filter */}
      {routeCustomers.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama pelanggan"
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-indigo-500 placeholder:text-gray-400 placeholder:font-medium"
            />
          </div>
          {!editMode && (
            <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
              {[['perlu', `Perlu didatangi (${pending.length})`], ['semua', `Semua (${routeCustomers.length})`]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${filter === value ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daftar rute */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Urutan Kunjungan</h2>
        {routeCustomers.length > 0 && listed.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-4">
            {query.trim() ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Tidak ada rumah yang perlu didatangi.'}
          </p>
        )}
        {listed.map((customer) => {
          const routeIndex = routeCustomers.findIndex((item) => item.id === customer.id);
          const history = historyOf(customer.id).slice(0, 3);
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
                <div className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0" style={{ background: TONE_COLORS[status.tone] }}>{routeNumberById[customer.id]}</div>
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
                  {history.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Riwayat kunjungan</p>
                      {history.map((visit) => <p key={visit.id} className="text-[10px] text-gray-500">{describeVisit(visit)}</p>)}
                    </div>
                  )}
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
                  <button type="button" disabled={routeIndex === 0} onClick={() => move(routeIndex, -1)} className="p-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button type="button" disabled={routeIndex === routeCustomers.length - 1} onClick={() => move(routeIndex, 1)} className="p-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30"><ChevronDown size={16} /></button>
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
            {notInRouteListed.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-gray-100">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{customer.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{customer.address || 'Alamat belum diisi'}</p>
                </div>
                <button type="button" onClick={() => addToRoute(customer)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white"><Plus size={13} /> Tambah</button>
              </div>
            ))}
            {notInRouteListed.length === 0 && <p className="text-xs text-gray-400 italic text-center py-3">{notInRoute.length === 0 ? 'Semua pelanggan sudah masuk rute.' : 'Tidak ada pelanggan yang cocok dengan pencarian.'}</p>}
          </div>
        </div>
      )}

      {/* Modal catat kunjungan */}
      {visitFor && <VisitModal customer={visitFor} onClose={() => setVisitFor(null)} onSave={onAddVisit} />}

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
