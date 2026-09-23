import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2 } from 'lucide-react';
import { parseCoordinates } from '../utils/geo';
import { addBaseLayers } from '../utils/leafletBase';
import { MAP_MAX_ZOOM } from '../utils/mapConfig';

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

const DEFAULT_CENTER = [-2.5, 118];

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#4f46e5;border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Memilih koordinat rumah: ketuk peta, geser penanda, atau tempel koordinat/link panjang Google Maps.
// value: { lat, lng } | null. otherPoints: titik lain (untuk menentukan pusat peta awal).
const LocationPicker = ({ value, onChange, otherPoints = [] }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateStatus, setLocateStatus] = useState(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const start = value ? [value.lat, value.lng] : (otherPoints[0] ? [otherPoints[0].lat, otherPoints[0].lng] : DEFAULT_CENTER);
    const map = L.map(containerRef.current, { maxZoom: MAP_MAX_ZOOM, attributionControl: false }).setView(start, value || otherPoints[0] ? 17 : 5);
    L.control.attribution({ prefix: false }).addTo(map);
    addBaseLayers(map);
    mapRef.current = map;

    const placeMarker = (lat, lng) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        return;
      }
      const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onChangeRef.current({ lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) });
      });
      markerRef.current = marker;
    };

    if (value) placeMarker(value.lat, value.lng);

    map.on('click', (event) => {
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      placeMarker(lat, lng);
      onChangeRef.current({ lat, lng });
    });

    // Peta sering dibuka di dalam modal; hitung ulang ukuran setelah tampil.
    const timer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Peta hanya dibuat sekali; perubahan value ditangani efek di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      const marker = L.marker([value.lat, value.lng], { icon: pinIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onChangeRef.current({ lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) });
      });
      markerRef.current = marker;
    }
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  }, [value]);

  const handlePaste = () => {
    const parsed = parseCoordinates(pasteText);
    if (!parsed) {
      setPasteError('Koordinat tidak terbaca. Tempel "lat, lng" atau link panjang Google Maps (bukan link pendek maps.app.goo.gl).');
      return;
    }
    setPasteError(null);
    setPasteText('');
    onChange(parsed);
  };

  const detectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateStatus({ ok: false, message: 'Perangkat/browser ini tidak mendukung deteksi lokasi.' });
      return;
    }
    setLocating(true);
    setLocateStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChange({ lat, lng });
        setLocateStatus({ ok: true, message: `Ditemukan: ${lat}, ${lng} (akurasi ±${Math.round(pos.coords.accuracy)}m)` });
      },
      (err) => {
        setLocating(false);
        const reason = err.code === 1
          ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini di pengaturan HP/browser, lalu coba lagi.'
          : err.code === 3
            ? 'Waktu deteksi habis (sinyal GPS lemah). Coba lagi di tempat terbuka.'
            : `Deteksi lokasi gagal (kode ${err.code}: ${err.message || 'tidak diketahui'}) — buka aplikasi lewat alamat https:// (bukan http:// biasa di jaringan lokal), GPS butuh koneksi aman.`;
        setLocateStatus({ ok: false, message: reason });
      },
      GEO_OPTIONS,
    );
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={detectLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-black rounded-xl active:scale-95 transition-all disabled:opacity-50"
      >
        {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        {locating ? 'Mencari lokasi...' : 'Gunakan Lokasi Saya'}
      </button>
      {locateStatus && (
        <p className={`text-[11px] font-bold ${locateStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>{locateStatus.message}</p>
      )}

      <div ref={containerRef} className="h-64 w-full rounded-2xl overflow-hidden border border-gray-200 z-0" />
      {value ? (
        <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          ✓ Koordinat terpakai otomatis: {value.lat}, {value.lng}. Geser penanda kapan saja untuk mengubah — tidak perlu tombol lain.
        </p>
      ) : (
        <p className="text-[11px] text-gray-500">Belum ada titik. Ketuk peta untuk menaruh penanda, lalu geser bila perlu.</p>
      )}

      <details className="text-xs">
        <summary className="text-gray-400 font-medium cursor-pointer select-none">Atau tempel koordinat / link Google Maps manual</summary>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder='"lat, lng" atau link Google Maps'
            className="flex-1 min-w-0 p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-medium focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handlePaste}
            className="shrink-0 px-3 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl active:scale-95 transition-all"
          >
            Terapkan
          </button>
        </div>
        {pasteError && <p className="text-[11px] font-bold text-red-600 mt-1">{pasteError}</p>}
      </details>
    </div>
  );
};

export default LocationPicker;
