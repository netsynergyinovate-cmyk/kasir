import { distanceMeters } from './geo';
import { formatRelativeTime } from './dashboardStats';

const MIN_MOVE_METERS = 30;
const HEARTBEAT_MS = 60_000;
const STALE_MINUTES = 10;

// Kapan posisi admin dikirim ke server: posisi pertama, setelah bergerak > 30 m, atau tiap 60 detik
// (agar superadmin tahu admin masih aktif walau diam). last = { lat, lng, at } upload terakhir.
export function shouldUploadLocation(last, next, nowMs) {
  if (!last) return true;
  if (nowMs - last.at >= HEARTBEAT_MS) return true;
  return distanceMeters(last, next) > MIN_MOVE_METERS;
}

// Umur posisi admin untuk ditampilkan di peta superadmin; > 10 menit dianggap tidak aktif.
export function describeLocationAge(updatedAt, now = new Date()) {
  const minutes = (now.getTime() - new Date(updatedAt).getTime()) / 60000;
  return { label: formatRelativeTime(updatedAt, now), stale: minutes > STALE_MINUTES };
}

// Titik untuk layanan routing: dimulai dari posisi admin (jika ada), lalu rumah-rumah yang dituju.
export function buildRoutePoints(origin, stops) {
  return origin ? [origin, ...stops] : [...stops];
}

// Indeks ruas jalan yang MENUJU rumah ke-j. Dengan posisi admin, ruas 0 = admin -> rumah 0.
export function legIndexFor(hasOrigin, stopIndex) {
  return hasOrigin ? stopIndex : stopIndex - 1;
}
