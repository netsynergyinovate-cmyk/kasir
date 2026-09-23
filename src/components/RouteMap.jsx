import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, Layers, LocateFixed, Plus, Minus, Focus, MapPin } from 'lucide-react';
import { TONE_COLORS } from '../utils/visits';
import { createBaseLayers } from '../utils/leafletBase';
import { MAP_MAX_ZOOM } from '../utils/mapConfig';

const DEFAULT_CENTER = [-2.5, 118];

// Marker pin teardrop ala Google Maps dengan nomor urut dan bayangan lembut
const googleMapPin = (number, color, selected) => {
  const pinW = selected ? 34 : 30;
  const pinH = selected ? 44 : 38;
  const stroke = selected ? '#1e1b4b' : '#ffffff';
  const strokeW = selected ? 2.5 : 1.5;

  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position:relative;width:${pinW}px;height:${pinH}px;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35));cursor:pointer;transition:transform 0.15s ease;">
        <svg width="${pinW}" height="${pinH}" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1C7.716 1 1 7.716 1 16c0 10.8 15 23 15 23s15-12.2 15-23c0-8.284-6.716-15-15-15z" fill="${color}" stroke="${stroke}" stroke-width="${strokeW}"/>
          <circle cx="16" cy="15" r="9.5" fill="#ffffff"/>
          <text x="16" y="19" text-anchor="middle" font-size="11" font-weight="900" fill="${color}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${number}</text>
        </svg>
      </div>
    `,
    iconSize: [pinW, pinH],
    iconAnchor: [pinW / 2, pinH],
    tooltipAnchor: [0, -pinH + 4],
  });
};

// Penanda posisi admin / diri sendiri ala Google Maps live blue dot dengan radar pulse
const personIcon = (self, stale) => {
  if (self) {
    return L.divIcon({
      className: 'google-live-dot',
      html: `
        <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:26px;height:26px;border-radius:9999px;background:#3b82f6;opacity:0.35;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:relative;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      tooltipAnchor: [0, -14],
    });
  }

  return L.divIcon({
    className: 'admin-marker-dot',
    html: `
      <div style="position:relative;width:30px;height:38px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <svg width="30" height="38" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1C7.716 1 1 7.716 1 16c0 10.8 15 23 15 23s15-12.2 15-23c0-8.284-6.716-15-15-15z" fill="${stale ? '#6b7280' : '#7c3aed'}" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="16" cy="15" r="9" fill="#ffffff"/>
          <text x="16" y="19" text-anchor="middle" font-size="11" font-weight="900" fill="${stale ? '#6b7280' : '#7c3aed'}" font-family="system-ui, sans-serif">A</text>
        </svg>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    tooltipAnchor: [0, -34],
  });
};

const RouteMap = ({ stops = [], routeLine, selectedId, onSelect, compact = false, people = [] }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const peopleLayerRef = useRef(null);
  const baseLayersRef = useRef(null);
  const fittedKeyRef = useRef('');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerMode, setLayerMode] = useState('satellite'); // 'satellite' | 'street'

  // Fungsi memusatkan peta ke semua titik pemberhentian & admin
  const fitAllBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = [...stops, ...people];
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [35, 35], maxZoom: 16 });
    }
  }, [stops, people]);

  // Fungsi memusatkan ke lokasi diri sendiri / admin terdekat
  const flyToSelf = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const self = people.find((p) => p.self) || people[0];
    if (self) {
      map.flyTo([self.lat, self.lng], 17, { duration: 1 });
    } else if (stops[0]) {
      map.flyTo([stops[0].lat, stops[0].lng], 16, { duration: 1 });
    }
  }, [people, stops]);

  // Ganti mode tampilan (Peta Jalan vs Satelit)
  const handleSetLayer = (mode) => {
    setLayerMode(mode);
    if (baseLayersRef.current) {
      baseLayersRef.current.setLayer(mode);
    }
  };

  // Zoom In / Out
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  // Inisialisasi peta Leaflet
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false, // Digantikan kontrol ala Google Maps yang bersih
      scrollWheelZoom: true,
      dragging: true, // Selalu aktif agar bisa digeser di HP maupun desktop
      touchZoom: true,
      doubleClickZoom: true,
      attributionControl: false,
    }).setView(DEFAULT_CENTER, 5);

    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);

    // Siapkan layer street & satellite
    const baseLayers = createBaseLayers(map, layerMode);
    baseLayersRef.current = baseLayers;

    layerRef.current = L.layerGroup().addTo(map);
    peopleLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Pastikan ukuran peta langsung pas saat pertama kali di-mount
    const timer = setTimeout(() => map.invalidateSize(), 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      peopleLayerRef.current = null;
      baseLayersRef.current = null;
      fittedKeyRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update ukuran peta saat mode layar penuh (fullscreen) diubah tanpa mereset posisi zoom pengguna
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Handle tombol ESC untuk keluar dari layar penuh
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Render jalur rute & pin pemberhentian
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Jalur rute jalan
    if (routeLine && routeLine.length > 1) {
      L.polyline(routeLine, { color: '#4f46e5', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
    } else if (stops.length > 1) {
      L.polyline(stops.map((stop) => [stop.lat, stop.lng]), { color: '#6366f1', weight: 3, dashArray: '6 8' }).addTo(layer);
    }

    // Pin tiap pelanggan
    stops.forEach((stop) => {
      const isSelected = stop.id === selectedId;
      const marker = L.marker([stop.lat, stop.lng], {
        icon: googleMapPin(stop.number, TONE_COLORS[stop.tone] || '#6b7280', isSelected),
        zIndexOffset: isSelected ? 1000 : 100 + stop.number,
      });

      const tooltip = document.createElement('div');
      tooltip.className = 'font-sans text-xs font-bold text-gray-800 py-0.5 px-1';
      tooltip.textContent = `${stop.number}. ${stop.title}`;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -38] });

      if (onSelect) marker.on('click', () => onSelect(stop.id));
      marker.addTo(layer);
    });

    const key = [...stops, ...people].map((item) => item.id).join(',');
    const points = [...stops, ...people];
    if (points.length > 0 && fittedKeyRef.current !== key) {
      map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [35, 35], maxZoom: 16 });
      fittedKeyRef.current = key;
    }
  }, [stops, routeLine, selectedId, onSelect, people]);

  // Render penanda posisi admin / live GPS
  useEffect(() => {
    const layer = peopleLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    people.forEach((person) => {
      if (person.accuracy && person.accuracy >= 15) {
        L.circle([person.lat, person.lng], {
          radius: person.accuracy,
          color: person.self ? '#2563eb' : '#7c3aed',
          weight: 1,
          fillOpacity: 0.12,
        }).addTo(layer);
      }
      const marker = L.marker([person.lat, person.lng], {
        icon: personIcon(person.self, person.stale),
        zIndexOffset: 2000,
      });
      const tooltip = document.createElement('span');
      tooltip.className = 'font-sans text-xs font-bold text-gray-800';
      tooltip.textContent = person.title;
      marker.bindTooltip(tooltip, { direction: 'top' });
      marker.addTo(layer);
    });
  }, [people]);

  const selectedStop = stops.find((s) => s.id === selectedId);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen bg-slate-900 animate-in fade-in duration-200'
          : `relative w-full ${compact ? 'h-64' : 'h-80'} rounded-2xl overflow-hidden border border-gray-100 shadow-sm z-0`
      }
    >
      {/* Kontainer Peta Leaflet: SELALU elemen pertama dengan key unik agar tidak tertukar saat rekonsiliasi React DOM */}
      <div
        key="leaflet-canvas-container"
        ref={containerRef}
        className="w-full h-full relative"
      />

      {/* Header saat mode Layar Penuh (Fullscreen) sebagai overlay di atas peta */}
      {isFullscreen && (
        <div key="fullscreen-top-header" className="absolute top-0 left-0 right-0 z-[1001] bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight leading-tight">Peta Rute Kunjungan</h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {stops.length} titik rumah · geser & perbesar peta untuk melihat detail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 shadow-sm"
            title="Kecilkan peta (ESC)"
          >
            <Minimize2 size={15} />
            <span>Kecilkan</span>
          </button>
        </div>
      )}

      {/* Kontrol Mengambang (Floating Controls Ala Google Maps) */}
      {/* 1. Tombol Pilihan Lapisan (Peta Jalan vs Satelit) */}
      <div className={`absolute ${isFullscreen ? 'top-16' : 'top-3'} left-3 z-[1000] flex items-center bg-white/95 backdrop-blur-sm rounded-xl p-1 shadow-md border border-gray-200/80`}>
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
            className="p-2.5 bg-white/95 hover:bg-white text-gray-700 text-xs font-bold rounded-xl shadow-md border border-gray-200/80 active:scale-95 transition-all backdrop-blur-sm flex items-center gap-1"
            title="Perbesar layar penuh"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      )}

      {/* 3. Tombol Navigasi Bawah Kanan (Pusatkan, Lokasi Saya, Zoom In / Out) */}
      <div className="absolute bottom-4 right-3 z-[1000] flex flex-col items-center gap-2">
        {/* Tombol Pusatkan Rute */}
        <button
          type="button"
          onClick={fitAllBounds}
          className="p-2.5 bg-white/95 hover:bg-white text-gray-700 rounded-xl shadow-md border border-gray-200/80 active:scale-95 transition-all backdrop-blur-sm"
          title="Pusatkan seluruh rute"
        >
          <Focus size={16} />
        </button>

        {/* Tombol Lokasi Saya */}
        {people.length > 0 && (
          <button
            type="button"
            onClick={flyToSelf}
            className="p-2.5 bg-white/95 hover:bg-white text-indigo-600 rounded-xl shadow-md border border-gray-200/80 active:scale-95 transition-all backdrop-blur-sm"
            title="Pusatkan ke lokasi saya"
          >
            <LocateFixed size={16} />
          </button>
        )}

        {/* Tombol Zoom Vertikal Ala Google Maps (+ dan -) */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200/80 overflow-hidden flex flex-col">
          <button
            type="button"
            onClick={zoomIn}
            className="p-2.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 transition-colors"
            title="Perbesar (Zoom In)"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="p-2.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            title="Perkecil (Zoom Out)"
          >
            <Minus size={16} />
          </button>
        </div>
      </div>

      {/* Info Rumah yang Terpilih saat Mode Layar Penuh */}
      {isFullscreen && selectedStop && (
        <div className="absolute bottom-4 left-4 right-16 z-[1000] max-w-sm bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-gray-200 space-y-1.5 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
              style={{ background: TONE_COLORS[selectedStop.tone] || '#6b7280' }}
            >
              {selectedStop.number}
            </span>
            <p className="text-xs font-black text-gray-900 truncate">{selectedStop.title}</p>
          </div>
          <p className="text-[11px] text-gray-500 truncate">Koordinat: {selectedStop.lat}, {selectedStop.lng}</p>
        </div>
      )}
    </div>
  );
};

export default RouteMap;
