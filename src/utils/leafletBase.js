import L from 'leaflet';
import { TILE_LAYERS } from './mapConfig';

const tile = (config) => L.tileLayer(config.url, {
  maxNativeZoom: config.maxNativeZoom,
  maxZoom: config.maxZoom,
  attribution: config.attribution,
  keepBuffer: 4, // simpan lebih banyak tile di sekitar layar agar tidak berkedip saat digeser/zoom
});

// Menambahkan peta dasar ke map Leaflet: "Satelit" (default, dengan label jalan/tempat) dan "Peta"
// (OpenStreetMap), lengkap dengan tombol pengganti di pojok kanan atas.
export function addBaseLayers(map) {
  const satellite = L.layerGroup([
    tile(TILE_LAYERS.satellite),
    tile(TILE_LAYERS.transportation),
    tile(TILE_LAYERS.places),
  ]);
  const street = tile(TILE_LAYERS.street);

  satellite.addTo(map);
  L.control.layers({ Satelit: satellite, Peta: street }, null, { position: 'topright', collapsed: true }).addTo(map);
}
