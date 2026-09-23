import L from 'leaflet';
import { TILE_LAYERS } from './mapConfig';

export const createTileLayer = (config) => L.tileLayer(config.url, {
  subdomains: config.subdomains || 'abc',
  maxNativeZoom: config.maxNativeZoom || 19,
  maxZoom: config.maxZoom || 20,
  attribution: config.attribution,
  keepBuffer: 6, // simpan lebih banyak tile di sekitar layar agar tidak berkedip saat digeser/zoom
});

export function createBaseLayers(map, defaultMode = 'satellite') {
  // Satelit Hibrida Google Maps (100% gratis, tanpa API key):
  // Menampilkan citra satelit tajam hingga zoom 20 di seluruh wilayah Indonesia
  // lengkap dengan nama jalan dan tempat, tidak hilang/blank saat diperbesar.
  const satellite = L.tileLayer(TILE_LAYERS.googleHybrid.url, {
    subdomains: TILE_LAYERS.googleHybrid.subdomains,
    maxNativeZoom: 20,
    maxZoom: TILE_LAYERS.googleHybrid.maxZoom,
    attribution: TILE_LAYERS.googleHybrid.attribution,
    keepBuffer: 6,
  });

  const street = createTileLayer(TILE_LAYERS.street);

  if (defaultMode === 'satellite') {
    satellite.addTo(map);
  } else {
    street.addTo(map);
  }

  let currentMode = defaultMode;

  const setLayer = (mode) => {
    if (mode === 'satellite') {
      if (map.hasLayer(street)) {
        map.removeLayer(street);
      }
      if (!map.hasLayer(satellite)) {
        satellite.addTo(map);
      }
      satellite.bringToBack();
      satellite.redraw();
    } else {
      if (map.hasLayer(satellite)) {
        map.removeLayer(satellite);
      }
      if (!map.hasLayer(street)) {
        street.addTo(map);
      }
      street.bringToBack();
      street.redraw();
    }
    currentMode = mode;
  };

  const getLayer = () => currentMode;

  return { street, satellite, setLayer, getLayer };
}

// Menambahkan peta dasar ke map Leaflet: "Satelit" (default) dan "Peta" (OpenStreetMap),
// lengkap dengan tombol pengganti di pojok kanan atas.
export function addBaseLayers(map, defaultMode = 'satellite') {
  const { street, satellite } = createBaseLayers(map, defaultMode);
  L.control.layers({ 'Satelit': satellite, 'Peta Jalan': street }, null, { position: 'topright', collapsed: true }).addTo(map);
}

