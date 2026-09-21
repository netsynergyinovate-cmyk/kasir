// Sumber peta gratis tanpa API key. Satelit: Esri World Imagery (+ lapisan label jalan dan tempat
// agar tampil seperti mode "Satelit" di Google Maps). Peta jalan: OpenStreetMap.
// Catatan: layanan tile gratis untuk pemakaian wajar; untuk pemakaian besar/komersial berat sebaiknya
// pindah ke penyedia berkunci (Esri, MapTiler, dll).
export const MAP_MAX_ZOOM = 20;

const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Sumber: Esri, Maxar, Earthstar Geographics, dan komunitas GIS';
const ESRI_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services';

// maxNativeZoom = zoom tertinggi yang benar-benar punya gambar. Di atasnya Leaflet memperbesar
// tile terakhir (maxZoom lebih tinggi) sehingga peta tidak kosong saat di-zoom. Citra satelit di banyak
// wilayah hanya tersedia sampai zoom 17-18; batas 18 menghindari tile abu-abu "data belum tersedia".
export const TILE_LAYERS = {
  satellite: {
    url: `${ESRI_BASE}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 18,
    maxZoom: MAP_MAX_ZOOM,
    attribution: ESRI_ATTRIBUTION,
  },
  transportation: {
    url: `${ESRI_BASE}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 18,
    maxZoom: MAP_MAX_ZOOM,
    attribution: ESRI_ATTRIBUTION,
  },
  places: {
    url: `${ESRI_BASE}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 18,
    maxZoom: MAP_MAX_ZOOM,
    attribution: ESRI_ATTRIBUTION,
  },
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    maxZoom: MAP_MAX_ZOOM,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};
