import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseCoordinates } from '../utils/geo';
import { addBaseLayers } from '../utils/leafletBase';
import { MAP_MAX_ZOOM } from '../utils/mapConfig';

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

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const start = value ? [value.lat, value.lng] : (otherPoints[0] ? [otherPoints[0].lat, otherPoints[0].lng] : DEFAULT_CENTER);
    const map = L.map(containerRef.current, { maxZoom: MAP_MAX_ZOOM }).setView(start, value || otherPoints[0] ? 17 : 5);
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Tempel koordinat / link Google Maps"
          className="flex-1 min-w-0 p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-medium focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={handlePaste}
          className="shrink-0 px-3 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
        >
          Terapkan
        </button>
      </div>
      {pasteError && <p className="text-[11px] font-bold text-red-600">{pasteError}</p>}

      <div ref={containerRef} className="h-64 w-full rounded-2xl overflow-hidden border border-gray-200 z-0" />
      <p className="text-[11px] text-gray-500">
        {value ? `Titik dipilih: ${value.lat}, ${value.lng}. ` : 'Belum ada titik. '}
        Ketuk peta untuk menaruh penanda, lalu geser bila perlu.
      </p>
    </div>
  );
};

export default LocationPicker;
