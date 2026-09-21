import { distanceMeters } from './geo';
import { formatRelativeTime } from './dashboardStats';

const MIN_MOVE_METERS = 10;
const MIN_INTERVAL_MS = 5_000;
const HEARTBEAT_MS = 30_000;
const STALE_MINUTES = 10;

// Kapan posisi admin dikirim ke server agar superadmin melihatnya nyaris real-time tanpa membanjiri server:
// posisi pertama; saat bergerak > 10 m (maksimal sekali per 5 detik, mengabaikan getaran GPS beberapa meter);
// dan tiap 30 detik walau diam supaya tetap terlihat "aktif". last = { lat, lng, at } unggahan terakhir.
export function shouldUploadLocation(last, next, nowMs) {
  if (!last) return true;
  const elapsed = nowMs - last.at;
  if (elapsed >= HEARTBEAT_MS) return true;
  if (elapsed < MIN_INTERVAL_MS) return false;
  return distanceMeters(last, next) > MIN_MOVE_METERS;
}

// Tingkat akurasi GPS dari nilai accuracy browser (meter). Akurasi rendah biasanya berarti browser memakai
// lokasi dari Wi-Fi/IP, bukan GPS (umum di laptop atau saat GPS HP mati).
export function accuracyLevel(accuracy) {
  if (accuracy === null || accuracy === undefined) {
    return { level: 'unknown', label: 'Akurasi belum diketahui', hint: '' };
  }
  const meters = Math.round(accuracy);
  if (meters <= 30) return { level: 'good', label: `Akurasi baik (±${meters} m)`, hint: '' };
  if (meters <= 100) return { level: 'fair', label: `Akurasi cukup (±${meters} m)`, hint: '' };
  return {
    level: 'poor',
    label: `Akurasi rendah (±${meters} m)`,
    hint: 'Aktifkan GPS/Lokasi akurasi tinggi di HP dan buka aplikasi di area terbuka. Di laptop lokasi biasanya hanya perkiraan dari Wi-Fi.',
  };
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

const ADVICE = {
  active: { tone: 'ok', text: 'Lokasi Anda dibagikan ke superadmin selama aplikasi terbuka. Rute dimulai dari posisi Anda.', canRetry: false },
  waiting: { tone: 'info', text: 'Menunggu izin lokasi. Jika dialog izin tidak muncul, ketuk Aktifkan lokasi.', canRetry: true },
  denied: {
    tone: 'warn',
    text: 'Izin lokasi ditolak. Ketuk ikon gembok atau pengaturan situs di address bar, ubah Lokasi menjadi Izinkan, lalu ketuk Aktifkan lokasi.',
    canRetry: true,
  },
  unavailable: { tone: 'warn', text: 'Lokasi belum tersedia (sinyal GPS lemah). Rute sementara dimulai dari rumah pertama.', canRetry: true },
  unsupported: { tone: 'warn', text: 'Perangkat ini tidak mendukung lokasi. Rute dimulai dari rumah pertama.', canRetry: false },
  insecure: {
    tone: 'warn',
    text: 'Lokasi hanya bisa dipakai lewat alamat https:// atau localhost. Buka aplikasi lewat https (setelah di-deploy) atau localhost, bukan lewat alamat IP http.',
    canRetry: false,
  },
};

// Pesan untuk admin sesuai status izin lokasi; null jika pelacakan tidak dipakai (mis. superadmin).
export function locationAdvice(status) {
  return ADVICE[status] || null;
}
