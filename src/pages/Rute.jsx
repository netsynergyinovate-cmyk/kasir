import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSearchParamSync } from '../hooks/useSearchParamSync';
import {
  Navigation, MapPin, Phone, ClipboardPen, ChevronUp, ChevronDown, X, Plus,
  Settings2, Route as RouteIcon, CheckCircle2, Loader2, Search, LocateFixed,
  GripVertical, Puzzle, ArrowUpToLine, ArrowDownToLine, Check
} from 'lucide-react';
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
const Rute = ({
  customers = [],
  transactions = [],
  visits = [],
  role,
  onAddVisit,
  onUpdateCustomerRoute,
  onBatchUpdateCustomerRoutes,
  defaultFilter = 'perlu',
  adminLocations = [],
}) => {
  const isSuper = role === 'superadmin';
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState(() => {
    return searchParams.get('filter') || localStorage.getItem('kasir_rute_filter') || defaultFilter;
  });
  const [editMode, setEditMode] = useState(() => {
    return searchParams.get('edit') === '1';
  });
  const [selectedId, setSelectedId] = useState(null);
  const [visitFor, setVisitFor] = useState(null);
  const [coordFor, setCoordFor] = useState(null);
  const [coordDraft, setCoordDraft] = useState(null);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [dueDateFilter, setDueDateFilter] = useState(() => searchParams.get('due') || '');

  useSearchParamSync(setSearchParams, 'filter', filter, defaultFilter, 'kasir_rute_filter');
  useSearchParamSync(setSearchParams, 'edit', editMode ? '1' : '');
  useSearchParamSync(setSearchParams, 'due', dueDateFilter);

  // State untuk mode penyusunan puzzle & urutan nomor
  const [draggedId, setDraggedId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [selectedForMove, setSelectedForMove] = useState(null);
  const [numberPickerFor, setNumberPickerFor] = useState(null);
  const [insertPickerFor, setInsertPickerFor] = useState(null);
  const [orderNotice, setOrderNotice] = useState('');

  const {
    routeCustomers, statusById, pending, nextStop, afterNext, paidCount,
    mapStops, route, routeLoading, legBefore, routeNumberById,
  } = useRouteData({ customers, transactions, visits });
  const notInRoute = customers.filter((customer) => customer.route_order === null || customer.route_order === undefined);

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
  const matchesDueDate = (customer) => !dueDateFilter || String(customer.due_date) === dueDateFilter;

  // Posisi admin (pelacakan) untuk superadmin: penanda di peta dan daftar di bawahnya.
  const people = useMemo(() => adminLocations.map((admin) => {
    const age = describeLocationAge(admin.updatedAt);
    return { id: admin.id, lat: admin.lat, lng: admin.lng, accuracy: admin.accuracy, title: `${admin.name} · ${age.label}`, stale: age.stale };
  }), [adminLocations]);

  // Mode Atur Rute selalu menampilkan semua rumah supaya urutan bisa disusun.
  const focusPending = filter === 'perlu' && !editMode;
  const listed = searchCustomers((focusPending ? pending : routeCustomers).filter(matchesDueDate), query);
  const notInRouteListed = searchCustomers(notInRoute.filter(matchesDueDate), query);
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

  // Helper untuk menerapkan urutan baru secara batch
  const applyNewOrder = async (orderedList, noticeMsg = 'Urutan rute berhasil diperbarui!') => {
    const updates = orderedList.map((customer, index) => ({
      id: customer.id,
      route_order: index + 1,
    }));

    setOrderNotice(noticeMsg);
    setTimeout(() => setOrderNotice(''), 3000);

    if (onBatchUpdateCustomerRoutes) {
      return onBatchUpdateCustomerRoutes(updates);
    }
    return Promise.all(updates.map((u) => onUpdateCustomerRoute(u.id, { route_order: u.route_order })));
  };

  // Geser 1 posisi ke atas atau ke bawah
  const move = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= routeCustomers.length) return;
    const list = [...routeCustomers];
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);
    await applyNewOrder(list, `Memindahkan ${moved.name} ke urutan #${targetIdx + 1}`);
  };

  // Pindahkan langsung ke posisi nomor tertentu (1-indexed)
  const moveToPosition = async (customerId, targetPosition1Indexed) => {
    const list = [...routeCustomers];
    const currentIdx = list.findIndex((c) => c.id === customerId);
    if (currentIdx === -1) return;
    const targetIdx = Math.max(0, Math.min(list.length - 1, targetPosition1Indexed - 1));
    if (currentIdx === targetIdx) return;
    const [moved] = list.splice(currentIdx, 1);
    list.splice(targetIdx, 0, moved);
    await applyNewOrder(list, `Memindahkan ${moved.name} ke urutan #${targetIdx + 1}`);
  };

  // Drag and Drop (puzzle) handler
  const handleDrop = async (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const list = [...routeCustomers];
    const srcIdx = list.findIndex((c) => c.id === sourceId);
    const tgtIdx = list.findIndex((c) => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const [moved] = list.splice(srcIdx, 1);
    const newTgtIdx = list.findIndex((c) => c.id === targetId);
    const insertIdx = srcIdx < tgtIdx ? newTgtIdx + 1 : newTgtIdx;
    list.splice(insertIdx, 0, moved);
    setDraggedId(null);
    setDropTargetId(null);
    await applyNewOrder(list, `Kepingan rute ${moved.name} diletakkan di urutan #${insertIdx + 1}`);
  };

  // Tambahkan atau sisipkan ke posisi tertentu
  const addToRoute = async (customer, targetPosition1Indexed) => {
    const list = [...routeCustomers];
    if (targetPosition1Indexed !== undefined && targetPosition1Indexed !== null) {
      const targetIdx = Math.max(0, Math.min(list.length, targetPosition1Indexed - 1));
      list.splice(targetIdx, 0, customer);
      await applyNewOrder(list, `${customer.name} disisipkan ke urutan #${targetIdx + 1}`);
    } else {
      const nextOrder = routeCustomers.length > 0 ? Math.max(...routeCustomers.map((c) => c.route_order)) + 1 : 1;
      await onUpdateCustomerRoute(customer.id, { route_order: nextOrder });
    }
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
            onClick={() => {
              setEditMode(!editMode);
              setSelectedForMove(null);
              setNumberPickerFor(null);
            }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${editMode ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white border border-gray-200 text-gray-700'}`}
          >
            <Settings2 size={14} /> {editMode ? 'Selesai' : 'Atur Rute'}
          </button>
        )}
      </div>

      {/* Banner Mode Puzzle & Penyusunan Urutan Rute */}
      {isSuper && editMode && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <span className="text-xl shrink-0 mt-0.5">🧩</span>
            <div>
              <p className="text-xs font-black text-indigo-950">Mode Susun Urutan Rute (Puzzle)</p>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Tarik kartu (<GripVertical className="inline" size={13} />) di laptop, klik nomor urut (<b>#</b>) untuk lompat langsung, atau gunakan tombol <b>Pindah</b> untuk menaruh di slot pilihan (ramah HP).
              </p>
            </div>
          </div>

          {orderNotice && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 animate-in fade-in">
              <Check size={14} className="shrink-0" />
              <span>{orderNotice}</span>
            </div>
          )}

          {selectedForMove && (
            <div className="bg-indigo-600 text-white p-3 rounded-xl flex items-center justify-between gap-2 shadow-md animate-in slide-in-from-top-1">
              <div className="min-w-0">
                <p className="text-xs font-bold">Sedang memindahkan: <b className="text-amber-300">{selectedForMove.name}</b></p>
                <p className="text-[10px] text-indigo-100">Ketuk tombol "Letakkan di Sini" pada posisi yang diinginkan di bawah.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForMove(null)}
                className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-bold shrink-0 active:scale-95 transition-all"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      )}

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
          {dueDateOptions.length > 0 && (
            <select
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-700 focus:border-indigo-500"
            >
              <option value="">Semua tanggal tagihan</option>
              {dueDateOptions.map((day) => (
                <option key={day} value={day}>Tagihan tanggal {day}</option>
              ))}
            </select>
          )}
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

        {listed.map((customer, listIdx) => {
          const routeIndex = routeCustomers.findIndex((item) => item.id === customer.id);
          const history = historyOf(customer.id).slice(0, 3);
          const status = statusById[customer.id];
          const leg = legBefore[customer.id];
          const isNext = nextStop && nextStop.id === customer.id;
          const isCurrentSelectedForMove = selectedForMove?.id === customer.id;

          return (
            <div key={customer.id} className="space-y-1.5">
              {/* Slot Target Tombol Letakkan di Sini (Mode Pilih & Letakkan HP) */}
              {isSuper && editMode && selectedForMove && !isCurrentSelectedForMove && listIdx === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    moveToPosition(selectedForMove.id, 1);
                    setSelectedForMove(null);
                  }}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/80 hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-sm"
                >
                  <span>⬇ Letakkan {selectedForMove.name} di Posisi Teratas (No. 1)</span>
                </button>
              )}

              {/* Kepingan Kartu Pelanggan ala Puzzle */}
              <div
                draggable={isSuper && editMode && !query.trim()}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', customer.id);
                  setDraggedId(customer.id);
                }}
                onDragOver={(e) => {
                  if (draggedId && draggedId !== customer.id) {
                    e.preventDefault();
                    setDropTargetId(customer.id);
                  }
                }}
                onDragLeave={() => {
                  if (dropTargetId === customer.id) setDropTargetId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(draggedId, customer.id);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropTargetId(null);
                }}
                onClick={() => setSelectedId(customer.id)}
                className={`bg-white p-3.5 rounded-2xl border shadow-sm space-y-2.5 transition-all ${
                  draggedId === customer.id ? 'opacity-40 border-dashed border-indigo-400 scale-[0.98]' : ''
                } ${
                  dropTargetId === customer.id ? 'ring-2 ring-indigo-500 bg-indigo-50/70 border-indigo-400' : ''
                } ${
                  isCurrentSelectedForMove ? 'ring-2 ring-amber-400 bg-amber-50/40 border-amber-300' : ''
                } ${
                  isNext ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'
                } ${
                  selectedId === customer.id && !selectedForMove ? 'bg-indigo-50/40' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Grip Handle & Nomor Urutan Interaktif */}
                  {isSuper && editMode ? (
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Tahan & geser untuk menyusun kepingan rute">
                        <GripVertical size={18} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setNumberPickerFor(customer)}
                        className="h-8 px-2.5 rounded-xl text-white text-xs font-black flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                        style={{ background: TONE_COLORS[status.tone] }}
                        title="Klik untuk memilih nomor urutan secara langsung"
                      >
                        <span>#{routeNumberById[customer.id]}</span>
                        <ChevronDown size={11} className="opacity-80" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0" style={{ background: TONE_COLORS[status.tone] }}>
                      {routeNumberById[customer.id]}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-gray-900 truncate">{customer.name}</p>
                      {isSuper && editMode && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md shrink-0">
                          Posisi #{routeNumberById[customer.id]}
                        </span>
                      )}
                    </div>
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

                {/* Tombol aksi kunjungan normal */}
                {status.key !== 'sudah_bayar' && !editMode && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <NavButton customer={customer} />
                    <button type="button" onClick={() => openVisit(customer)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 active:scale-95 transition-all">
                      <ClipboardPen size={14} /> Catat Kunjungan
                    </button>
                  </div>
                )}

                {/* Bilah Tombol Pengaturan Urutan Rute (Superadmin Mode Edit) */}
                {isSuper && editMode && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    {/* Ke Paling Atas (#1) */}
                    <button
                      type="button"
                      disabled={routeIndex === 0}
                      onClick={() => moveToPosition(customer.id, 1)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-25 active:scale-95 transition-all"
                      title="Paling Atas (Jadikan No. 1)"
                    >
                      <ArrowUpToLine size={15} />
                    </button>

                    {/* Naik 1 Tingkat */}
                    <button
                      type="button"
                      disabled={routeIndex === 0}
                      onClick={() => move(routeIndex, -1)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-25 active:scale-95 transition-all"
                      title="Naik 1 posisi"
                    >
                      <ChevronUp size={15} />
                    </button>

                    {/* Turun 1 Tingkat */}
                    <button
                      type="button"
                      disabled={routeIndex === routeCustomers.length - 1}
                      onClick={() => move(routeIndex, 1)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-25 active:scale-95 transition-all"
                      title="Turun 1 posisi"
                    >
                      <ChevronDown size={15} />
                    </button>

                    {/* Ke Paling Bawah (#Akhir) */}
                    <button
                      type="button"
                      disabled={routeIndex === routeCustomers.length - 1}
                      onClick={() => moveToPosition(customer.id, routeCustomers.length)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-25 active:scale-95 transition-all"
                      title="Paling Bawah (Jadikan Terakhir)"
                    >
                      <ArrowDownToLine size={15} />
                    </button>

                    {/* Tombol Pilih & Letakkan (Tap-to-place untuk HP) */}
                    <button
                      type="button"
                      onClick={() => setSelectedForMove(isCurrentSelectedForMove ? null : customer)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-all ${
                        isCurrentSelectedForMove
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                      title="Pilih untuk dipindahkan ke posisi lain"
                    >
                      <Puzzle size={13} />
                      <span>{isCurrentSelectedForMove ? 'Batal' : 'Pindah'}</span>
                    </button>

                    {/* Tombol Pilih Nomor Langsung */}
                    <button
                      type="button"
                      onClick={() => setNumberPickerFor(customer)}
                      className="px-2.5 py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all"
                      title="Ganti nomor urutan langsung"
                    >
                      <span>No #{routeNumberById[customer.id]}</span>
                    </button>

                    {/* Ubah Koordinat */}
                    <button
                      type="button"
                      onClick={() => openCoords(customer)}
                      className="flex-1 min-w-[110px] flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      <MapPin size={13} /> {hasCoords(customer) ? 'Ubah koordinat' : 'Isi koordinat'}
                    </button>

                    {/* Keluarkan dari Rute */}
                    <button
                      type="button"
                      onClick={() => onUpdateCustomerRoute(customer.id, { route_order: null })}
                      className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all"
                      title="Keluarkan dari rute"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Slot Target Tombol Letakkan di Sini setelah kartu ini */}
              {isSuper && editMode && selectedForMove && !isCurrentSelectedForMove && (
                <button
                  type="button"
                  onClick={() => {
                    moveToPosition(selectedForMove.id, routeIndex + 1);
                    setSelectedForMove(null);
                  }}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/80 hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-sm"
                >
                  <span>⬇ Letakkan {selectedForMove.name} di Sini (Jadikan No. {routeIndex + 1})</span>
                </button>
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
              <div key={customer.id} className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{customer.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{customer.address || 'Alamat belum diisi'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => addToRoute(customer)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                    title="Tambahkan ke urutan paling belakang"
                  >
                    <Plus size={13} /> Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => setInsertPickerFor(customer)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all"
                    title="Sisipkan ke posisi urutan tertentu"
                  >
                    Sisipkan...
                  </button>
                </div>
              </div>
            ))}
            {notInRouteListed.length === 0 && <p className="text-xs text-gray-400 italic text-center py-3">{notInRoute.length === 0 ? 'Semua pelanggan sudah masuk rute.' : 'Tidak ada pelanggan yang cocok dengan pencarian.'}</p>}
          </div>
        </div>
      )}

      {/* Modal Dialog Pemilih Nomor Posisi Langsung (Direct Number Selector) */}
      {numberPickerFor && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setNumberPickerFor(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-indigo-600 font-black text-xs uppercase tracking-wide">
                <Puzzle size={15} /> Atur Nomor Rute
              </div>
              <h3 className="text-base font-black text-gray-900 mt-1 truncate">{numberPickerFor.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Urutan sekarang: <b>#{routeNumberById[numberPickerFor.id]}</b> dari {routeCustomers.length} pelanggan
              </p>
            </div>

            {/* Tombol Pintas Cepat Awal & Akhir */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  moveToPosition(numberPickerFor.id, 1);
                  setNumberPickerFor(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <ArrowUpToLine size={14} /> Posisi No. 1 (Awal)
              </button>
              <button
                type="button"
                onClick={() => {
                  moveToPosition(numberPickerFor.id, routeCustomers.length);
                  setNumberPickerFor(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <ArrowDownToLine size={14} /> Posisi #{routeCustomers.length} (Akhir)
              </button>
            </div>

            {/* Kotak Pilihan Nomor Urut */}
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Slot Nomor Urut:</p>
              <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 border border-gray-100 rounded-2xl bg-gray-50/50">
                {routeCustomers.map((occupant, i) => {
                  const pos = i + 1;
                  const isCurrent = routeNumberById[numberPickerFor.id] === pos;
                  const occupantTone = TONE_COLORS[statusById[occupant.id]?.tone] || '#6b7280';
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => {
                        moveToPosition(numberPickerFor.id, pos);
                        setNumberPickerFor(null);
                      }}
                      title={isCurrent ? 'Posisi Anda saat ini' : `Terisi: ${occupant.name}`}
                      className={`min-h-14 rounded-xl font-black flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-all active:scale-95 ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                          : 'bg-white hover:bg-indigo-50 text-gray-700 border border-gray-200 shadow-xs'
                      }`}
                    >
                      <span className="text-sm">{pos}</span>
                      <span
                        className="text-[8px] font-bold normal-case truncate max-w-full"
                        style={isCurrent ? undefined : { color: occupantTone }}
                      >
                        {isCurrent ? 'Anda' : occupant.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sisipkan Pelanggan ke Posisi Tertentu */}
      {insertPickerFor && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setInsertPickerFor(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-indigo-600 font-black text-xs uppercase tracking-wide">
                <Plus size={15} /> Sisipkan ke Rute
              </div>
              <h3 className="text-base font-black text-gray-900 mt-1 truncate">{insertPickerFor.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pilih nomor urutan slot di mana pelanggan ini akan disisipkan:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  addToRoute(insertPickerFor, 1);
                  setInsertPickerFor(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <ArrowUpToLine size={14} /> Posisi No. 1 (Awal)
              </button>
              <button
                type="button"
                onClick={() => {
                  addToRoute(insertPickerFor, routeCustomers.length + 1);
                  setInsertPickerFor(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <ArrowDownToLine size={14} /> Posisi Akhir (#{routeCustomers.length + 1})
              </button>
            </div>

            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Atau Pilih Posisi Nomor Urut:</p>
              <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-100 rounded-2xl bg-gray-50/50">
                {Array.from({ length: routeCustomers.length + 1 }, (_, i) => i + 1).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      addToRoute(insertPickerFor, pos);
                      setInsertPickerFor(null);
                    }}
                    className="h-11 rounded-xl font-black text-sm bg-white hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 border border-gray-200 shadow-xs flex items-center justify-center transition-all active:scale-95"
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
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
