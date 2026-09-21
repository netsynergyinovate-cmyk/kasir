const inRange = (lat, lng) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const NUMBER = '(-?\\d+(?:\\.\\d+)?)';

// Membaca koordinat dari teks "lat, lng" atau link Google Maps panjang. Link pendek
// (maps.app.goo.gl) tidak bisa dibaca dari browser, jadi mengembalikan null.
export function parseCoordinates(text) {
  const input = String(text || '').trim();
  if (!input) return null;

  const patterns = [
    new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
    new RegExp(`@${NUMBER},${NUMBER}`),
    new RegExp(`[?&](?:q|ll|query|center)=${NUMBER}(?:,|%2C)${NUMBER}`),
    new RegExp(`^${NUMBER}\\s*[,\\s]\\s*${NUMBER}$`),
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      return inRange(lat, lng) ? { lat, lng } : null;
    }
  }
  return null;
}

// Membuka aplikasi Google Maps dengan petunjuk arah ke satu tujuan (gratis, tanpa API key).
export function googleMapsNavUrl({ lat, lng }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

// Petunjuk arah beberapa pemberhentian sekaligus; titik terakhir jadi tujuan, maksimal 9 titik singgah.
export function googleMapsRouteUrl(points) {
  if (points.length === 1) return googleMapsNavUrl(points[0]);

  const destination = points[points.length - 1];
  const waypoints = points
    .slice(0, -1)
    .slice(0, 9)
    .map((point) => `${point.lat},${point.lng}`)
    .join('%7C');

  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&waypoints=${waypoints}&travelmode=driving`;
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(seconds) {
  if (seconds < 60) return 'kurang dari 1 menit';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

// Jarak garis lurus antar dua titik (meter), rumus haversine.
export function distanceMeters(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}
