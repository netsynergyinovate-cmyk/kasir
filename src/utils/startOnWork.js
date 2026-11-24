import { distanceMeters } from './geo';
import { normalizeAdminAccess } from './permissions';
import { toInputValue } from './dashboardStats';
import { formatShortDate } from './visits';

const STORAGE_KEY = 'start_on_work';

// shortcut: radius tetap 50 m; naikkan bila GPS HP lapangan sering meleset dari titik rumah.
export const ARRIVE_METERS = 50;

export const WORK_EVENT_LABELS = {
  mulai: 'Mulai kerja',
  berangkat: 'Berangkat ke',
  tiba: 'Tiba di',
  tidak_ada_di_rumah: 'Tidak ada di rumah',
  uang_belum_ada: 'Ada di rumah, bayar nanti',
  bayar_langsung: 'Bayar langsung',
  selesai: 'Selesai kerja',
};

// Sesi kerja disimpan di perangkat supaya bertahan saat aplikasi di-refresh, dan supaya App bisa
// mengunci halaman Transaksi. Bentuk: { userId, sessionId, startedAt, targetId, arrivedId, doneIds }.
export function readWork(userId) {
  try {
    const work = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return work && userId && work.userId === userId ? work : null;
  } catch {
    return null;
  }
}

export function writeWork(work) {
  try {
    if (work) localStorage.setItem(STORAGE_KEY, JSON.stringify(work));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // penyimpanan tidak tersedia; sesi tetap jalan di memori
  }
}

// Rentang tanggal kerja lapangan diatur superadmin per admin: allowed_paths.work_range = { from, to }
// ('YYYY-MM-DD', boleh salah satu kosong). Belum diatur = setiap hari.
export function isWorkDay(allowedPaths, date = new Date()) {
  const range = normalizeAdminAccess(allowedPaths).work_range;
  const today = toInputValue(date);
  return (!range?.from || today >= range.from) && (!range?.to || today <= range.to);
}

// '2026-12-01'..'2026-12-15' -> '1 Des – 15 Des'
export function describeWorkRange(range) {
  if (!range?.from && !range?.to) return 'Setiap hari';
  if (!range.to) return `Mulai ${formatShortDate(range.from)}`;
  if (!range.from) return `Sampai ${formatShortDate(range.to)}`;
  return `${formatShortDate(range.from)} – ${formatShortDate(range.to)}`;
}

// Sudah tiba di rumah pelanggan tapi belum melapor: pembayaran pelanggan lain dikunci.
export const isPaymentLocked = (work) => Boolean(work?.arrivedId);

const hasCoords = (customer) => typeof customer.lat === 'number' && typeof customer.lng === 'number';

export const hasArrived = (position, target) =>
  Boolean(position && target && hasCoords(target) && distanceMeters(position, target) <= ARRIVE_METERS);

// Tujuan berikutnya: ikuti urutan rute superadmin; bila rute habis/tidak ada, rumah terdekat dari admin.
// Rumah yang sudah ditangani di sesi ini (doneIds) dilewati.
export function pickNextTarget({ routeStops = [], otherStops = [], position = null, doneIds = [] }) {
  const usable = (list) => list.filter((customer) => hasCoords(customer) && !doneIds.includes(customer.id));
  const route = usable(routeStops);
  if (route.length) return route[0];
  const rest = usable(otherStops);
  if (!position) return rest[0] || null;
  return rest.reduce(
    (best, customer) => (!best || distanceMeters(position, customer) < distanceMeters(position, best) ? customer : best),
    null,
  );
}
