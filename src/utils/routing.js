// Jalur jalan raya dari rumah ke rumah memakai layanan routing OSRM publik (gratis, tanpa API key).
// Layanan demo ini tanpa jaminan ketersediaan, jadi hasil di-cache di perangkat dan pemanggil harus
// menyiapkan cadangan (garis lurus) saat hasilnya null.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_PREFIX = 'kasir_route_';
const MAX_POINTS = 50;

export function buildRouteUrl(points) {
  const path = points.map((point) => `${point.lng},${point.lat}`).join(';');
  return `${OSRM_BASE}/${path}?overview=full&geometries=geojson&steps=false`;
}

const cacheKey = (points) =>
  CACHE_PREFIX + points.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|');

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // penyimpanan penuh atau tidak tersedia; abaikan
  }
};

export async function fetchRoadRoute(points, { fetchImpl = fetch } = {}) {
  const usable = points.slice(0, MAX_POINTS);
  if (usable.length < 2) return null;

  const key = cacheKey(usable);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const response = await fetchImpl(buildRouteUrl(usable));
    if (!response.ok) return null;

    const data = await response.json();
    const route = data.code === 'Ok' ? data.routes?.[0] : null;
    if (!route) return null;

    const result = {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: route.legs.map((leg) => ({ distance: leg.distance, duration: leg.duration })),
      distance: route.distance,
      duration: route.duration,
    };
    writeCache(key, result);
    return result;
  } catch {
    return null;
  }
}
