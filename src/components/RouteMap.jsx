import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_COLORS } from '../utils/visits';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DEFAULT_CENTER = [-2.5, 118];

const numberIcon = (number, color, selected) => L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px system-ui;border:${selected ? '4px solid #1e1b4b' : '3px solid #fff'};box-shadow:0 2px 6px rgba(0,0,0,.35)">${number}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Peta rute. stops: [{ id, lat, lng, number, statusKey, title }]. routeLine: [[lat, lng], ...] jalur jalan
// dari layanan routing; jika null dipakai garis lurus putus-putus sebagai cadangan.
const RouteMap = ({ stops, routeLine, selectedId, onSelect }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedKeyRef = useRef('');

  useEffect(() => {
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 5);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedKeyRef.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (routeLine && routeLine.length > 1) {
      L.polyline(routeLine, { color: '#4f46e5', weight: 5, opacity: 0.85 }).addTo(layer);
    } else if (stops.length > 1) {
      L.polyline(stops.map((stop) => [stop.lat, stop.lng]), { color: '#6366f1', weight: 3, dashArray: '6 8' }).addTo(layer);
    }

    stops.forEach((stop) => {
      const marker = L.marker([stop.lat, stop.lng], {
        icon: numberIcon(stop.number, STATUS_COLORS[stop.statusKey] || '#6b7280', stop.id === selectedId),
        zIndexOffset: stop.id === selectedId ? 1000 : 0,
      });

      // textContent (bukan HTML) supaya nama pelanggan tidak bisa menyisipkan markup.
      const tooltip = document.createElement('span');
      tooltip.textContent = `${stop.number}. ${stop.title}`;
      marker.bindTooltip(tooltip);

      if (onSelect) marker.on('click', () => onSelect(stop.id));
      marker.addTo(layer);
    });

    const key = stops.map((stop) => stop.id).join(',');
    if (stops.length > 0 && fittedKeyRef.current !== key) {
      map.fitBounds(L.latLngBounds(stops.map((stop) => [stop.lat, stop.lng])), { padding: [30, 30], maxZoom: 16 });
      fittedKeyRef.current = key;
    }
  }, [stops, routeLine, selectedId, onSelect]);

  return <div ref={containerRef} className="h-72 w-full rounded-2xl overflow-hidden border border-gray-100 z-0" />;
};

export default RouteMap;
