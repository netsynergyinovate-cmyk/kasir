import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TONE_COLORS } from '../utils/visits';
import { addBaseLayers } from '../utils/leafletBase';
import { MAP_MAX_ZOOM } from '../utils/mapConfig';

const DEFAULT_CENTER = [-2.5, 118];

const numberIcon = (number, color, selected) => L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px system-ui;border:${selected ? '4px solid #1e1b4b' : '3px solid #fff'};box-shadow:0 2px 6px rgba(0,0,0,.35)">${number}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Peta rute. stops: [{ id, lat, lng, number, tone, title }]. routeLine: [[lat, lng], ...] jalur jalan
// dari layanan routing; jika null dipakai garis lurus putus-putus sebagai cadangan.
// compact: dipakai di dashboard; scroll mouse tidak memperbesar peta dan di HP satu jari tetap menggulir halaman.
const RouteMap = ({ stops, routeLine, selectedId, onSelect, compact = false }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedKeyRef = useRef('');

  useEffect(() => {
    const map = L.map(containerRef.current, {
      maxZoom: MAP_MAX_ZOOM,
      scrollWheelZoom: !compact,
      dragging: !(compact && L.Browser.mobile),
    }).setView(DEFAULT_CENTER, 5);
    addBaseLayers(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedKeyRef.current = '';
    };
  }, [compact]);

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
        icon: numberIcon(stop.number, TONE_COLORS[stop.tone] || '#6b7280', stop.id === selectedId),
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

  return <div ref={containerRef} className={`${compact ? 'h-56' : 'h-72'} w-full rounded-2xl overflow-hidden border border-gray-100 z-0`} />;
};

export default RouteMap;
