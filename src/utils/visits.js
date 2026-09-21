import { toInputValue } from './dashboardStats';

export const OUTCOME_LABELS = {
  tidak_ada_di_rumah: 'Tidak ada di rumah',
  uang_belum_ada: 'Uang belum ada',
};

// Warna penanda peta dan lencana menurut status kunjungan.
export const STATUS_COLORS = {
  sudah_bayar: '#16a34a',
  perlu_didatangi: '#dc2626',
  belum_dikunjungi: '#dc2626',
  menunggu: '#f59e0b',
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// '2026-09-25' -> '25 Sep'
export function formatShortDate(isoDate) {
  if (!isoDate) return '';
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

const sameMonth = (date, now) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

const isPaidThisMonth = (customer, transactions, now) =>
  transactions.some((trx) =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase() &&
    sameMonth(new Date(trx.date), now)
  );

// Status kunjungan pelanggan pada bulan tagihan berjalan:
//  sudah_bayar      - ada pembayaran retail LUNAS bulan ini (otomatis dari Kasir)
//  belum_dikunjungi - belum ada catatan kunjungan bulan ini
//  menunggu         - sudah dicoba hari ini, atau menunggu tanggal "kapan ada" di masa depan
//  perlu_didatangi  - pernah dikunjungi tapi sudah waktunya didatangi lagi
export function customerVisitStatus(customer, visits, transactions, now = new Date()) {
  if (isPaidThisMonth(customer, transactions, now)) {
    return { key: 'sudah_bayar', label: 'Sudah bayar', visit: null, availableOn: null };
  }

  const latest = visits
    .filter((visit) => visit.customer_id === customer.id && sameMonth(new Date(visit.visited_at), now))
    .sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime())[0];

  if (!latest) {
    return { key: 'belum_dikunjungi', label: 'Belum dikunjungi', visit: null, availableOn: null };
  }

  const today = toInputValue(now);
  const availableOn = latest.available_on || null;
  const visitedToday = toInputValue(new Date(latest.visited_at)) === today;
  const waiting = visitedToday || (availableOn !== null && availableOn > today);

  const outcome = OUTCOME_LABELS[latest.outcome] || latest.outcome;
  const label = availableOn ? `${outcome} · kapan ada: ${formatShortDate(availableOn)}` : outcome;

  return { key: waiting ? 'menunggu' : 'perlu_didatangi', label, visit: latest, availableOn };
}

// Rumah yang masih perlu didatangi, tetap dalam urutan rute yang disusun superadmin.
export function pendingStops(orderedStops, statusById) {
  return orderedStops.filter((stop) => {
    const key = statusById[stop.id]?.key;
    return key === 'belum_dikunjungi' || key === 'perlu_didatangi';
  });
}
