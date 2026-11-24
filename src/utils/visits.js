import { toInputValue } from './dashboardStats';

export const OUTCOME_LABELS = {
  tidak_ada_di_rumah: 'Tidak ada di rumah',
  uang_belum_ada: 'Uang belum ada',
};

// Warna status kunjungan: merah = belum dikunjungi, kuning = tidak ada di rumah,
// biru muda = uang belum ada (menunggu tanggal bayar), hijau = sudah dibayar.
export const TONE_COLORS = {
  red: '#dc2626',
  yellow: '#eab308',
  blue: '#38bdf8',
  green: '#16a34a',
};

export const TONE_BADGE_CLASSES = {
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-sky-100 text-sky-700',
  green: 'bg-emerald-100 text-emerald-700',
};

const OUTCOME_TONES = {
  tidak_ada_di_rumah: 'yellow',
  uang_belum_ada: 'blue',
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// '2026-09-25' -> '25 Sep'
export function formatShortDate(isoDate) {
  if (!isoDate) return '';
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

const sameMonth = (date, now) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

// Transaksi baru memakai customerName (camelCase), yang dibaca dari database memakai customer_name.
export const isPaidThisMonth = (customer, transactions, now = new Date()) =>
  transactions.some((trx) =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || trx.customer_name || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase() &&
    sameMonth(new Date(trx.date), now)
  );

// Status kunjungan pelanggan pada bulan tagihan berjalan:
//  sudah_bayar      - ada pembayaran retail LUNAS bulan ini (otomatis dari Kasir)
//  belum_dikunjungi - belum ada catatan kunjungan bulan ini
//  menunggu         - sudah dicoba hari ini, atau menunggu tanggal "kapan ada" di masa depan
//  perlu_didatangi  - pernah dikunjungi tapi sudah waktunya didatangi lagi
export function customerVisitStatus(customer, visits, transactions, now = new Date()) {
  if (isPaidThisMonth(customer, transactions, now)) {
    return { key: 'sudah_bayar', tone: 'green', label: 'Sudah terbayarkan', visit: null, availableOn: null };
  }

  const latest = visits
    .filter((visit) => visit.customer_id === customer.id && sameMonth(new Date(visit.visited_at), now))
    .sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime())[0];

  if (!latest) {
    return { key: 'belum_dikunjungi', tone: 'red', label: 'Belum dikunjungi', visit: null, availableOn: null };
  }

  const today = toInputValue(now);
  const availableOn = latest.available_on || null;
  const visitedToday = toInputValue(new Date(latest.visited_at)) === today;
  const waiting = visitedToday || (availableOn !== null && availableOn > today);

  const outcome = OUTCOME_LABELS[latest.outcome] || latest.outcome;
  const label = availableOn ? `${outcome} · kapan ada: ${formatShortDate(availableOn)}` : outcome;

  return { key: waiting ? 'menunggu' : 'perlu_didatangi', tone: OUTCOME_TONES[latest.outcome] || 'yellow', label, visit: latest, availableOn };
}

// Rumah yang masih perlu didatangi, tetap dalam urutan rute yang disusun superadmin.
export function pendingStops(orderedStops, statusById) {
  return orderedStops.filter((stop) => {
    const key = statusById[stop.id]?.key;
    return key === 'belum_dikunjungi' || key === 'perlu_didatangi';
  });
}

const SHORT_WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Pilihan "kapan ada": 7 hari setelah hari ini, dimulai dari besok.
export function nextSevenDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index + 1);
    const value = toInputValue(date);
    const label = index === 0 ? 'Besok' : `${SHORT_WEEKDAYS[date.getDay()]} ${formatShortDate(value)}`;
    return { value, label };
  });
}

// Satu baris riwayat kunjungan, contoh: "21 Sep · Tidak ada di rumah · kapan ada: 22 Sep".
export function describeVisit(visit) {
  const day = formatShortDate(toInputValue(new Date(visit.visited_at)));
  const outcome = OUTCOME_LABELS[visit.outcome] || visit.outcome;
  const parts = [day, outcome];
  if (visit.available_on) parts.push(`kapan ada: ${formatShortDate(visit.available_on)}`);
  return parts.join(' · ');
}

// Pencarian pelanggan berdasarkan nama, nama panggilan, atau alamat (tanpa membedakan huruf besar/kecil).
export function searchCustomers(customers, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return customers;
  return customers.filter((customer) =>
    [customer.name, customer.nickname, customer.address].some((field) => (field || '').toLowerCase().includes(needle))
  );
}

// Data yang disimpan untuk satu kunjungan. "Tidak ada di rumah" hanya dicatat untuk hari itu (tanpa tanggal);
// hanya "uang belum ada" yang membawa hari kapan uangnya ada.
export function buildVisitPayload(customerId, outcome, availableOn) {
  return {
    customer_id: customerId,
    outcome,
    available_on: outcome === 'uang_belum_ada' ? availableOn : null,
  };
}
