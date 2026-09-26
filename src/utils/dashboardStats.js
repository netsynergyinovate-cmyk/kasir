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

// Transaksi ini benar-benar dikerjakan akun (admin) yang sedang login? Diutamakan cocokkan lewat
// cashierId (akun asli, tidak berubah walau nama diganti); transaksi lama yang belum punya cashierId
// dicocokkan lewat nama sebagai cadangan. Dipakai supaya "Jasa Kasir" (komisi) seorang admin TIDAK
// pernah ikut menghitung transaksi yang dikerjakan superadmin atau admin lain.
export function isOwnTransaction(trx, userId, fullName) {
  const cashierId = trx.cashierId || trx.cashier_id;
  if (cashierId) return cashierId === userId;
  if (!fullName) return false;
  return (trx.cashierName || trx.cashier_name) === fullName;
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

// KASBON SESUNGGUHNYA dari angka transaksi (harga paket vs uang yang sudah masuk), bukan cuma teks
// status yang tersimpan. Transaksi LAMA (dibuat sebelum status KASBON otomatis ada di Transaksi.jsx)
// yang sebenarnya dibayar kurang tetap tercatat status "LUNAS" di database — fungsi ini yang bikin
// Riwayat & Dashboard tetap membacanya sebagai kasbon walau label lamanya salah, supaya piutang
// beneran kebaca real, gak ada selisih. CS (penyesuaian customer service) dikecualikan, sama seperti
// shouldSyncTransaction di runsnetSync.js — bukan kekurangan bayar dari pelanggan.
export function isEffectivelyKasbon(trx) {
  if (trx.type !== 'retail') return false;
  if ((trx.payment_method || trx.paymentMethod) === 'CS') return false;
  const price = Number(trx.price || 0);
  const paid = Number(trx.amountPaid ?? trx.amount_paid ?? price);
  return trx.status === 'KASBON' || paid < price;
}

// Ringkasan piutang KASBON: jumlah transaksi dan total kekurangannya (harga paket - uang yang sudah
// masuk). Pemanggil mengirim transaksi yang SUDAH difilter periodenya (bulan/hari yang sedang dilihat),
// supaya "Piutang Kasbon" di Dashboard selalu sinkron dengan periode kartu-kartu lain di sekitarnya.
export function kasbonSummary(transactions) {
  const kasbonTrx = transactions.filter(isEffectivelyKasbon);
  const shortfall = kasbonTrx.reduce((sum, trx) => {
    const paid = Number(trx.amountPaid ?? trx.amount_paid ?? 0);
    return sum + Math.max(Number(trx.price || 0) - paid, 0);
  }, 0);
  return { count: kasbonTrx.length, shortfall };
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

// Omset per hari untuk `days` hari terakhir (termasuk `endDate`), urut dari yang paling lama ke
// paling baru — dipakai untuk daftar "Omset 7 Hari Terakhir" di Dashboard.
export function weeklyRevenue(transactions, endDate, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - i);
    result.push({ date, ...dailyStats(transactions, date) });
  }
  return result;
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

export const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

// Proyeksi pendapatan sampai akhir bulan memakai laju rata-rata harian sejauh ini (run-rate).
export function projectMonthRevenue(revenue, now = new Date()) {
  return Math.round((revenue / now.getDate()) * daysInMonth(now));
}

const normalizeName = (value) => (value || '').trim().toLowerCase();

const customerMonthlyPrice = (customer, packages) => {
  const own = Number(customer.price);
  if (own > 0) return own;
  const pkg = packages.find((p) => normalizeName(p.name) === normalizeName(customer.package));
  return pkg ? Number(pkg.price) || 0 : 0;
};

// Rincian penagihan bulan berjalan untuk pelanggan aktif: jumlah + nominal yang sudah masuk dan yang masih
// tertunggak (tagihan = harga pelanggan, atau harga paketnya bila harga pelanggan kosong).
export function paymentBreakdown(customers, transactions, packages = [], now = new Date()) {
  const active = customers.filter((customer) => customer.status === 'aktif');
  const paidTransactions = transactions.filter(
    (trx) => trx.type === 'retail' && trx.status === 'LUNAS' && inMonth(trx, now.getFullYear(), now.getMonth())
  );
  const paidNames = new Set(paidTransactions.map((trx) => normalizeName(trx.customerName || trx.customer_name)));
  const activeNames = new Set(active.map((customer) => normalizeName(customer.name)));

  const paidCustomers = active.filter((customer) => paidNames.has(normalizeName(customer.name)));
  const unpaidCustomers = active.filter((customer) => !paidNames.has(normalizeName(customer.name)));

  const paidAmount = paidTransactions
    .filter((trx) => activeNames.has(normalizeName(trx.customerName || trx.customer_name)))
    .reduce((sum, trx) => sum + Number(trx.price || 0), 0);
  const unpaidAmount = unpaidCustomers.reduce((sum, customer) => sum + customerMonthlyPrice(customer, packages), 0);

  return {
    active: active.length,
    paid: paidCustomers.length,
    unpaid: unpaidCustomers.length,
    paidPercent: active.length > 0 ? Math.round((paidCustomers.length / active.length) * 100) : 0,
    paidAmount,
    unpaidAmount,
  };
}
