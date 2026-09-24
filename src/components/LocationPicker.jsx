import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2, Search, Maximize2, Minimize2, Plus, Minus, Check, MapPin, X } from 'lucide-react';
import { parseCoordinates } from '../utils/geo';
import { createBaseLayers } from '../utils/leafletBase';
import { MAP_MAX_ZOOM } from '../utils/mapConfig';

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
const DEFAULT_CENTER = [-2.5, 118];

// Pin merah khas Google Maps dengan ujung presisi dan bayangan lembut
const googleDropPinIcon = L.divIcon({
  className: 'google-drop-pin',
  html: `
    <div style="position:relative;width:34px;height:44px;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.4));cursor:grab;">
      <svg width="34" height="44" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 1C7.716 1 1 7.716 1 16c0 10.8 15 23 15 23s15-12.2 15-23c0-8.284-6.716-15-15-15z" fill="#ea4335" stroke="#b31412" stroke-width="1.5"/>
        <circle cx="16" cy="15" r="5.5" fill="#ffffff"/>
      </svg>
    </div>
  `,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
  tooltipAnchor: [0, -42],
});

// Memilih koordinat rumah: ketuk peta, geser penanda, cari alamat gratis (Nominatim), atau tempel link Google Maps.
const LocationPicker = ({ value, onChange, otherPoints = [] }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const baseLayersRef = useRef(null);
  const onChangeRef = useRef(onChange);

  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateStatus, setLocateStatus] = useState(null);

  // Kontrol tampilan ala Google Maps
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerMode, setLayerMode] = useState('satellite'); // 'satellite' | 'street'

  // Pencarian alamat gratis via Nominatim OpenStreetMap
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Pasang atau pindahkan penanda titik koordinat
  const placeMarker = useCallback((lat, lng, centerMap = false) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { icon: googleDropPinIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        const newCoords = { lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) };
        onChangeRef.current(newCoords);
      });
      marker.bindTooltip('Geser pin ini ke lokasi yang tepat', { direction: 'top', offset: [0, -42] });
      markerRef.current = marker;
    }

    if (centerMap) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
    }
  }, []);

  // Inisialisasi peta Leaflet
  useEffect(() => {
    if (!containerRef.current) return;

    const start = value
      ? [value.lat, value.lng]
      : otherPoints[0]
        ? [otherPoints[0].lat, otherPoints[0].lng]
        : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false,
      scrollWheelZoom: true,
      dragging: true, // Selalu bisa digeser oleh admin
      touchZoom: true,
      doubleClickZoom: true,
      attributionControl: false,
    }).setView(start, value || otherPoints[0] ? 17 : 5);

    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);

    const baseLayers = createBaseLayers(map, layerMode);
    baseLayersRef.current = baseLayers;
    mapRef.current = map;

    if (value) {
      placeMarker(value.lat, value.lng);
    }

    // Ketuk peta di mana saja untuk memindahkan pin
    map.on('click', (event) => {
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      placeMarker(lat, lng);
      onChangeRef.current({ lat, lng });
    });

    const timer = setTimeout(() => map.invalidateSize(), 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      baseLayersRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronisasi saat prop value berubah dari luar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      placeMarker(value.lat, value.lng);
    }
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  }, [value, placeMarker]);

  // Update ukuran peta saat mode layar penuh berubah
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Ganti lapisan Street vs Satellite
  const handleSetLayer = (mode) => {
    setLayerMode(mode);
    if (baseLayersRef.current) {
      baseLayersRef.current.setLayer(mode);
    }
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  // Pencarian lokasi gratis via OpenStreetMap Nominatim
  const handleSearchInput = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimeoutRef.current);
    if (!text.trim() || text.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=id&limit=5`,
          { headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowSearchResults(true);
        }
      } catch (err) {
        console.error('Nominatim search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const selectSearchResult = (item) => {
    const lat = Number(Number(item.lat).toFixed(6));
    const lng = Number(Number(item.lon).toFixed(6));
    placeMarker(lat, lng, true);
    onChange({ lat, lng });
    setShowSearchResults(false);
    setSearchQuery(item.display_name.split(',')[0]);
  };

  // Tempel link Google Maps atau format "lat, lng"
  const handlePaste = () => {
    const parsed = parseCoordinates(pasteText);
    if (!parsed) {
      setPasteError('Koordinat tidak terbaca. Tempel "lat, lng" atau link panjang Google Maps.');
      return;
    }
    setPasteError(null);
    setPasteText('');
    placeMarker(parsed.lat, parsed.lng, true);
    onChange(parsed);
  };

  // Deteksi lokasi admin menggunakan GPS perangkat
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
        placeMarker(lat, lng, true);
        onChange({ lat, lng });
        setLocateStatus({ ok: true, message: `Ditemukan: ${lat}, ${lng} (akurasi ±${Math.round(pos.coords.accuracy)}m)` });
      },
      (err) => {
        setLocating(false);
        const reason = err.code === 1
          ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini di pengaturan HP/browser.'
          : err.code === 3
            ? 'Waktu deteksi habis (sinyal GPS lemah). Coba lagi di tempat terbuka.'
            : `Deteksi lokasi gagal (${err.message || 'koneksi GPS terputus'}).`;
        setLocateStatus({ ok: false, message: reason });
      },
      GEO_OPTIONS,
    );
  };

  return (
    <div className="space-y-3">
      {/* Kolom Pencarian Alamat Gratis (Nominatim OSM) */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
            placeholder="Cari jalan, desa, kelurahan, atau tempat..."
            className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-semibold text-gray-800 focus:border-indigo-500 placeholder:text-gray-400"
          />
          {searching ? (
            <Loader2 size={15} className="absolute right-3 text-indigo-600 animate-spin" />
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
              className="absolute right-3 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Dropdown Hasil Pencarian Alamat */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 divide-y divide-gray-100 z-50 max-h-56 overflow-y-auto">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectSearchResult(item)}
                className="w-full text-left p-2.5 hover:bg-indigo-50/50 flex items-start gap-2 transition-colors"
              >
                <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate">{item.display_name.split(',')[0]}</p>
                  <p className="text-[10px] text-gray-400 truncate">{item.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tombol Deteksi Lokasi GPS */}
      <button
        type="button"
        onClick={detectLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl active:scale-95 transition-all disabled:opacity-50 shadow-sm shadow-indigo-200"
      >
        {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
        {locating ? 'Mencari lokasi GPS...' : 'Gunakan Lokasi Saya (GPS)'}
      </button>

      {locateStatus && (
        <p className={`text-[11px] font-bold ${locateStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {locateStatus.message}
        </p>
      )}

      {/* Kontainer Peta Leaflet (Mendukung Fullscreen / Perbesar) */}
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-[9999] w-screen h-screen bg-slate-900 animate-in fade-in duration-200'
            : 'relative w-full h-72 rounded-2xl overflow-hidden border border-gray-200 shadow-sm z-0'
        }
      >
        {/* Area peta: SELALU elemen pertama dengan key unik agar tidak tertukar saat rekonsiliasi React DOM */}
        <div
          key="location-picker-canvas"
          ref={containerRef}
          className="w-full h-full relative"
        />

        {/* Header saat mode layar penuh sebagai overlay */}
        {isFullscreen && (
          <div key="picker-fullscreen-header" className="absolute top-0 left-0 right-0 z-[1001] bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center">
                <MapPin size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black">Pilih Titik Lokasi Rumah</h3>
                <p className="text-[11px] text-slate-400">Ketuk atau geser pin merah ke atap rumah pelanggan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
            >
              <Minimize2 size={15} />
              <span>Selesai</span>
            </button>
          </div>
        )}

        {/* Kontrol Mengambang (Ala Google Maps) */}
        {/* 1. Tombol Pilihan Lapisan Satelit vs Peta Jalan */}
        <div className={`absolute ${isFullscreen ? 'top-16' : 'top-3'} left-3 z-[1000] flex items-center bg-white/95 backdrop-blur-sm rounded-xl p-1 shadow-md border border-gray-200`}>
          <button
            type="button"
            onClick={() => handleSetLayer('street')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              layerMode === 'street'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
            title="Tampilkan Peta Jalan"
          >
            <span>🗺️ Peta</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetLayer('satellite')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              layerMode === 'satellite'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
            title="Tampilkan Satelit Hibrida"
          >
            <span>🛰️ Satelit</span>
          </button>
        </div>

        {/* 2. Tombol Perbesar / Layar Penuh (Kanan Atas saat tidak fullscreen) */}
        {!isFullscreen && (
          <div className="absolute top-3 right-3 z-[1000]">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-2.5 bg-white/95 hover:bg-white text-gray-700 text-xs font-bold rounded-xl shadow-md border border-gray-200 active:scale-95 transition-all backdrop-blur-sm"
              title="Perbesar layar penuh"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        )}

        {/* 3. Tombol Zoom dan GPS (Kanan Bawah) */}
        <div className="absolute bottom-4 right-3 z-[1000] flex flex-col items-center gap-2">
          {/* Tombol Lokasi Saya */}
          <button
            type="button"
            onClick={detectLocation}
            className="p-2.5 bg-white/95 hover:bg-white text-indigo-600 rounded-xl shadow-md border border-gray-200 active:scale-95 transition-all backdrop-blur-sm"
            title="Arahkan ke lokasi GPS saya"
          >
            <LocateFixed size={16} />
          </button>

          {/* Tombol Zoom Vertikal Ala Google Maps */}
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={zoomIn}
              className="p-2.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 transition-colors"
              title="Perbesar"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              className="p-2.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              title="Perkecil"
            >
              <Minus size={16} />
            </button>
          </div>
        </div>

        {/* Footer info koordinat saat mode layar penuh */}
        {isFullscreen && value && (
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 border-t border-slate-800 flex items-center justify-between text-white z-10 shrink-0">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Titik Terpilih</p>
              <p className="text-xs font-mono font-bold text-emerald-400">{value.lat}, {value.lng}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95"
            >
              <Check size={16} /> Gunakan Titik Ini
            </button>
          </div>
        )}
      </div>

      {/* Info status koordinat */}
      {value ? (
        <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <span>✓ Koordinat: <b className="font-mono">{value.lat}, {value.lng}</b></span>
          <span className="text-[10px] text-emerald-600 font-medium">Geser pin merah untuk mengubah titik</span>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">
          Belum ada titik. Ketuk peta atau cari alamat untuk menaruh penanda, lalu geser ke titik rumah yang tepat.
        </p>
      )}

      {/* Tempel link Google Maps atau teks koordinat manual */}
      <details className="text-xs">
        <summary className="text-gray-400 font-medium cursor-pointer select-none">
          Atau tempel koordinat / link Google Maps manual
        </summary>
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
