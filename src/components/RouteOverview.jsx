import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, MapPin, Route as RouteIcon, CheckCircle2, Loader2 } from 'lucide-react';
import RouteMap from './RouteMap';
import VisitModal from './VisitModal';
import StatusBadge from './StatusBadge';
import { useRouteData, hasCoords } from '../hooks/useRouteData';
import { googleMapsNavUrl, formatDistance, formatDuration } from '../utils/geo';
import { TONE_COLORS } from '../utils/visits';
import StatusLegend from './StatusLegend';

// Ringkasan rute kunjungan untuk Dashboard: peta satelit + jalur jalan + tujuan berikutnya.
// Peta, jalur, tujuan berikutnya, dan catatan kunjungan dalam satu kartu. Untuk admin ini menggantikan
// halaman Rute terpisah; superadmin mengatur rute di halaman Rute.
const RouteOverview = ({ customers = [], transactions = [], visits = [], onAddVisit, canManageRoute = false }) => {
  const [visitFor, setVisitFor] = useState(null);
  // Dashboard ringkas: rumah yang infonya sudah diisi (menunggu janji / sudah bayar) disembunyikan,
  // hanya yang masih perlu didatangi yang tampil di peta dan daftar.
  const {
    routeCustomers, statusById, pending, nextStop, afterNext, paidCount, waitingCount,
    mapStops, route, routeLoading, legBefore, routeNumberById,
  } = useRouteData({ customers, transactions, visits, onlyPending: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-3 ml-1">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
          <RouteIcon size={12} /> Rute Kunjungan
        </h2>
        {canManageRoute && <Link to="/rute" className="text-[10px] text-blue-600 font-bold hover:underline mr-1">Atur Rute</Link>}
      </div>

      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        {routeCustomers.length === 0 ? (
          <div className="text-center py-4 space-y-1">
            <MapPin className="mx-auto text-gray-300" size={26} />
            <p className="text-xs font-bold text-gray-700">Belum ada rute kunjungan.</p>
            <p className="text-[11px] text-gray-500">Superadmin belum menyusun rute rumah pelanggan.</p>
          </div>
        ) : (
          <>
            {pending.length === 0 ? null : mapStops.length > 0 ? (
              <>
                <RouteMap compact stops={mapStops} routeLine={route?.coordinates || null} />
                <StatusLegend />
              </>
            ) : (
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <MapPin className="mx-auto text-indigo-400" size={22} />
                <p className="text-xs font-bold text-indigo-900 mt-1">Peta muncul setelah koordinat rumah diisi.</p>
                <p className="text-[11px] text-indigo-700">Minta superadmin mengisi koordinat rumah pelanggan.</p>
              </div>
            )}

            <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
              <span><b>{pending.length}</b> perlu didatangi · <b>{waitingCount}</b> menunggu janji · <b>{paidCount}</b> sudah terbayarkan</span>
              {routeLoading && <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> menghitung jalur...</span>}
              {route && <span>· jalur {formatDistance(route.distance)} (~{formatDuration(route.duration)})</span>}
            </p>

            {nextStop ? (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-3.5 rounded-xl space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Tujuan berikutnya</p>
                <div>
                  <p className="text-base font-black leading-tight">{nextStop.name}</p>
                  <p className="text-[11px] text-indigo-100 mt-0.5 flex items-start gap-1"><MapPin size={12} className="shrink-0 mt-0.5" /> {nextStop.address || 'Alamat belum diisi'}</p>
                  <p className="text-[11px] text-indigo-100 mt-1">{statusById[nextStop.id]?.label}</p>
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
            )}

            {pending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Urutan kunjungan</p>
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {pending.map((customer) => {
                  const status = statusById[customer.id];
                  const leg = legBefore[customer.id];
                  return (
                    <div key={customer.id} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                      <div className="w-7 h-7 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0" style={{ background: TONE_COLORS[status.tone] }}>{routeNumberById[customer.id]}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-gray-900 truncate">{customer.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{customer.address || 'Alamat belum diisi'}</p>
                        <div className="mt-1"><StatusBadge status={status} /></div>
                        {leg && <p className="text-[10px] text-gray-400 mt-1">Dari rumah sebelumnya: {formatDistance(leg.distance)} · {formatDuration(leg.duration)}</p>}
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

      {visitFor && onAddVisit && <VisitModal customer={visitFor} onClose={() => setVisitFor(null)} onSave={onAddVisit} />}
    </div>
  );
};

export default RouteOverview;
