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
  bayar_langsung: 'Ada di rumah, bayar di tempat',
  selesai: 'Selesai kerja',
  pengingat: 'Pengingat terkirim',
};

// Sesi kerja disimpan di perangkat supaya bertahan saat aplikasi di-refresh, dan supaya App bisa
// mengunci halaman Transaksi. Bentuk: { userId, sessionId, startedAt, targetId, arrivedId, doneIds, paying }.
// paying: { id, name } pelanggan yang sedang dibayar di Transaksi lewat pilihan "Ada di rumah".
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

// Jadwal kerja lapangan per admin, diatur superadmin (semua opsional):
// allowed_paths.work_range = { from, to } tanggal 'YYYY-MM-DD' + { start, end } jam 'HH:MM'.
// Kosong = setiap hari / sepanjang hari. Jam start > end berarti melewati tengah malam (mis. 20:00–04:00).
export function isWorkTime(allowedPaths, date = new Date()) {
  const range = normalizeAdminAccess(allowedPaths).work_range;
  const today = toInputValue(date);
  const inDates = (!range?.from || today >= range.from) && (!range?.to || today <= range.to);
  if (!inDates || !range?.start || !range?.end) return inDates;
  const now = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return range.start <= range.end ? now >= range.start && now < range.end : now >= range.start || now < range.end;
}

// -> '1 Des – 15 Des · 08:00–17:00'
export function describeWorkRange(range) {
  let dates = 'Setiap hari';
  if (range?.from && range?.to) dates = `${formatShortDate(range.from)} – ${formatShortDate(range.to)}`;
  else if (range?.from) dates = `Mulai ${formatShortDate(range.from)}`;
  else if (range?.to) dates = `Sampai ${formatShortDate(range.to)}`;
  return range?.start && range?.end ? `${dates} · ${range.start}–${range.end}` : dates;
}

const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Dipanggil setelah transaksi tersimpan: kalau itu pembayaran Start On Work, tandai selesai dan kembalikan
// true supaya App mengarahkan admin kembali ke halaman Start On Work.
export function finishWorkPayment(userId, customerName) {
  const work = readWork(userId);
  if (!work?.paying || !sameName(work.paying.name, customerName)) return false;
  writeWork({ ...work, paying: null });
  return true;
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
