// Sapaan menurut jam (waktu lokal perangkat).
export function getGreeting(hour) {
  if (hour >= 4 && hour <= 10) return 'Selamat pagi';
  if (hour >= 11 && hour <= 14) return 'Selamat siang';
  if (hour >= 15 && hour <= 17) return 'Selamat sore';
  return 'Selamat malam';
}

// Persentase perubahan dibulatkan. null = tidak ada pembanding (nilai sebelumnya 0 tapi sekarang ada).
export function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// Sukses = LUNAS atau invoice instansi (definisi sama dengan kartu "Progres Penagihan" di Dashboard).
const isSuccess = (trx) => trx.status === 'LUNAS' || trx.type === 'instansi';

const inMonth = (trx, year, month) => {
  const date = new Date(trx.date);
  return date.getFullYear() === year && date.getMonth() === month;
};

// Pendapatan = total kotor (jumlah price semua transaksi periode, sama dengan kartu "Total Kotor").
function monthlyStats(transactions, year, month) {
  const inPeriod = transactions.filter((trx) => inMonth(trx, year, month));
  return {
    revenue: inPeriod.reduce((sum, trx) => sum + Number(trx.price || 0), 0),
    count: inPeriod.filter(isSuccess).length,
  };
}

export function compareMonths(transactions, now = new Date()) {
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const current = monthlyStats(transactions, now.getFullYear(), now.getMonth());
  const previous = monthlyStats(transactions, previousDate.getFullYear(), previousDate.getMonth());

  return {
    current,
    previous,
    revenueChange: percentChange(current.revenue, previous.revenue),
    countChange: percentChange(current.count, previous.count),
  };
}

export function cashierPerformance(transactions, year, month) {
  const byCashier = new Map();

  transactions
    .filter((trx) => inMonth(trx, year, month) && isSuccess(trx))
    .forEach((trx) => {
      const name = trx.cashier_name || trx.cashierName || 'Tidak diketahui';
      const entry = byCashier.get(name) || { name, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += Number(trx.price || 0);
      byCashier.set(name, entry);
    });

  return [...byCashier.values()].sort((a, b) => b.revenue - a.revenue);
}

// Waktu relatif singkat untuk kolom "login terakhir".
export function formatRelativeTime(iso, now = new Date()) {
  if (!iso) return 'Belum pernah login';
  const diffMinutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${Math.floor(diffHours / 24)} hari lalu`;
}

// Pelanggan aktif yang sudah/belum membayar (retail LUNAS) pada bulan berjalan.
export function paymentSummary(customers, transactions, now = new Date()) {
  const active = customers.filter((customer) => customer.status === 'aktif');
  const paidNames = new Set(
    transactions
      .filter((trx) => trx.type === 'retail' && trx.status === 'LUNAS' && inMonth(trx, now.getFullYear(), now.getMonth()))
      .map((trx) => (trx.customerName || '').trim().toLowerCase())
  );
  const paid = active.filter((customer) => paidNames.has((customer.name || '').trim().toLowerCase())).length;
  return { active: active.length, paid, unpaid: active.length - paid };
}
