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

// Pendapatan = jumlah price transaksi yang sukses (LUNAS / instansi), yaitu uang yang benar-benar masuk.
// Berbeda dengan kartu "Total Kotor" di Dashboard lama yang menjumlah semua transaksi termasuk belum lunas.
function periodStats(transactions, matches) {
  const successful = transactions.filter((trx) => matches(trx) && isSuccess(trx));
  return {
    revenue: successful.reduce((sum, trx) => sum + Number(trx.price || 0), 0),
    count: successful.length,
  };
}

const monthlyStats = (transactions, year, month) => periodStats(transactions, (trx) => inMonth(trx, year, month));

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

const sameDay = (trx, date) => {
  const trxDate = new Date(trx.date);
  return trxDate.getFullYear() === date.getFullYear()
    && trxDate.getMonth() === date.getMonth()
    && trxDate.getDate() === date.getDate();
};

export function dailyStats(transactions, date) {
  return periodStats(transactions, (trx) => sameDay(trx, date));
}

export function compareDays(transactions, date) {
  const previousDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const current = dailyStats(transactions, date);
  const previous = dailyStats(transactions, previousDate);
  return {
    current,
    previous,
    revenueChange: percentChange(current.revenue, previous.revenue),
    countChange: percentChange(current.count, previous.count),
  };
}

// Menentukan hari yang dipilih: 'today' | 'yesterday' | 'custom' (nilai custom berformat yyyy-mm-dd).
export function resolveDay(mode, now = new Date(), customValue = '') {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === 'yesterday') return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (mode === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(customValue)) {
    const [year, month, day] = customValue.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return today;
}

// yyyy-mm-dd (waktu lokal), format yang dipakai <input type="date">.
export function toInputValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Transaksi sukses pada satu hari, urut dari yang paling awal (untuk buku kas harian).
export function dailyTransactions(transactions, date) {
  return transactions
    .filter((trx) => sameDay(trx, date) && isSuccess(trx))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Rincian uang masuk pada satu hari per metode pembayaran, terbesar dulu.
export function methodBreakdown(transactions, date) {
  const byMethod = new Map();

  dailyTransactions(transactions, date).forEach((trx) => {
    const method = trx.payment_method || trx.paymentMethod || 'Tidak dicatat';
    const entry = byMethod.get(method) || { method, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(trx.price || 0);
    byMethod.set(method, entry);
  });

  return [...byMethod.values()].sort((a, b) => b.revenue - a.revenue);
}
