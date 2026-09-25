import { isOwnTransaction } from './dashboardStats';
import { supabase } from '../lib/supabase';
import { normalizeAdminAccess } from './permissions';
import { formatRupiah } from './format';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Akun khusus yang menerima atribusi transaksi kasir toko umum (transaksi tanpa admin spesifik lain).
export const usesStoreAttribution = (adminName = '') => (adminName || '').toLowerCase().includes('wahyu');

/**
 * Transaksi yang dihitung sebagai komisi seorang admin. Satu-satunya tempat aturan atribusi ditulis,
 * dipakai dashboard admin maupun superadmin supaya angkanya selalu sama.
 */
export function matchingCommissionTransactions(transactions = [], adminId = '', adminName = '', adminRole = 'admin') {
  // Superadmin tidak pernah mendapatkan komisi
  if (adminRole === 'superadmin') return [];

  const storeAttribution = usesStoreAttribution(adminName);

  return transactions.filter((t) => {
    const isPaid = t.status === 'LUNAS' || t.type === 'instansi';
    const isCS = t.payment_method === 'CS' ||
                 (t.cashier_name || '').toLowerCase().includes('cs') ||
                 (t.cashierName || '').toLowerCase().includes('cs');
    if (!isPaid || isCS) return false;

    // Akun dengan atribusi toko: sertakan transaksi kasir umum / toko yang belum spesifik atas admin lain
    if (storeAttribution) {
      const isSpecificOtherAdmin = t.cashier_id && t.cashier_id !== adminId &&
                                   t.cashier_name && !t.cashier_name.toLowerCase().includes('wahyu') &&
                                   !t.cashier_name.toLowerCase().includes('admin');
      if (isSpecificOtherAdmin) return false;
      return true;
    }

    return isOwnTransaction(t, adminId, adminName);
  });
}

const pad2 = (n) => String(n).padStart(2, '0');

// Kunci bulan 'YYYY-MM' dari Date / string tanggal (waktu lokal); null bila tidak valid.
export function monthKey(raw) {
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function monthLabel(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || '');
  return match ? `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}` : 'Tanpa tanggal';
}

// Bulan komisi yang dibayar oleh sebuah pencairan: field `period` bila ada, jika tidak bulan tanggal kirimnya.
export const payoutPeriodKey = (payout) => payout?.period || monthKey(payout?.sent_at);

// Bulan yang diberi tambahan komisi (bonus) oleh Superadmin: field `period`, atau bulan tanggal pemberiannya.
export const bonusPeriodKey = (bonus) => bonus?.period || monthKey(bonus?.given_at);

const validBonuses = (bonuses) => (Array.isArray(bonuses) ? bonuses.filter((b) => Number(b?.amount) > 0) : []);

/**
 * Kalkulasi komisi admin. Komisi dihitung PER BULAN bila `period` ('YYYY-MM') diberikan:
 * - totalEarned: transaksi lunas bulan itu yang diproses admin * adminFee
 * - totalPaid: pencairan Superadmin yang dicatat untuk bulan itu
 * - pendingBalance: sisa yang belum dicairkan untuk bulan itu (minimal 0)
 * - Tambahan komisi (bonus) dari Superadmin untuk bulan itu ikut menambah totalEarned.
 * Tanpa `period` seluruh transaksi, bonus, dan pencairan dijumlahkan (total semua bulan).
 */
export function calculateAdminCommissions(
  transactions = [],
  adminId = '',
  adminName = '',
  adminFee = 10000,
  commissionHistory = [],
  adminRole = 'admin',
  period = null,
  bonuses = []
) {
  const feePerTransaction = Number(adminFee) || 10000;
  const scopedTransactions = period
    ? transactions.filter((t) => monthKey(t.date || t.created_at) === period)
    : transactions;
  const matchingTrx = matchingCommissionTransactions(scopedTransactions, adminId, adminName, adminRole);
  const instansiCount = matchingTrx.filter((t) => t.type === 'instansi').length;

  const autoEarned = matchingTrx.length * feePerTransaction;
  const allBonuses = adminRole === 'superadmin' ? [] : validBonuses(bonuses);
  const periodBonuses = period ? allBonuses.filter((b) => bonusPeriodKey(b) === period) : allBonuses;
  const bonusTotal = periodBonuses.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalEarned = autoEarned + bonusTotal;
  const validHistory = Array.isArray(commissionHistory) ? commissionHistory : [];
  const periodHistory = period ? validHistory.filter((c) => payoutPeriodKey(c) === period) : validHistory;
  const totalPaid = periodHistory
    .filter((c) => c.status === 'TERKIRIM')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const pendingBalance = Math.max(0, totalEarned - totalPaid);

  return {
    period,
    earnedTrxCount: matchingTrx.length,
    instansiCount,
    feePerTransaction,
    usesStoreAttribution: adminRole !== 'superadmin' && usesStoreAttribution(adminName),
    autoEarned,
    bonusTotal,
    periodBonuses,
    allBonuses,
    totalEarned,
    totalPaid,
    pendingBalance,
    history: validHistory,
    periodHistory,
  };
}

/**
 * Rincian komisi per bulan (terbaru dulu): transaksi dihitung, hak komisi, yang sudah dicairkan untuk bulan itu,
 * dan sisanya. Bulan yang hanya punya pencairan (tanpa transaksi) tetap muncul.
 */
export function commissionByMonth(
  transactions = [],
  adminId = '',
  adminName = '',
  adminFee = 10000,
  adminRole = 'admin',
  commissionHistory = [],
  bonuses = []
) {
  const fee = Number(adminFee) || 10000;
  const buckets = new Map();
  const bucketFor = (key) => {
    if (!buckets.has(key)) buckets.set(key, { key, label: monthLabel(key), count: 0, auto: 0, bonus: 0, amount: 0, paid: 0, pending: 0 });
    return buckets.get(key);
  };

  matchingCommissionTransactions(transactions, adminId, adminName, adminRole).forEach((t) => {
    const entry = bucketFor(monthKey(t.date || t.created_at) || 'unknown');
    entry.count += 1;
    entry.auto += fee;
  });

  if (adminRole !== 'superadmin') {
    validBonuses(bonuses).forEach((b) => { bucketFor(bonusPeriodKey(b) || 'unknown').bonus += Number(b.amount); });
  }

  if (adminRole !== 'superadmin' && Array.isArray(commissionHistory)) {
    commissionHistory
      .filter((c) => c.status === 'TERKIRIM')
      .forEach((c) => { bucketFor(payoutPeriodKey(c) || 'unknown').paid += Number(c.amount) || 0; });
  }

  const rank = (key) => (key === 'unknown' ? '' : key);
  return [...buckets.values()]
    .map((entry) => {
      const amount = entry.auto + entry.bonus;
      return { ...entry, amount, pending: Math.max(0, amount - entry.paid) };
    })
    .sort((x, y) => (rank(x.key) < rank(y.key) ? 1 : rank(x.key) > rank(y.key) ? -1 : 0));
}

/**
 * Rekap komisi satu bulan dalam bentuk teks siap disalin/dikirim (WhatsApp). `data` = hasil
 * calculateAdminCommissions dengan period.
 */
export function buildCommissionRecap(adminName, data) {
  const lines = [
    `*Rekap Komisi ${adminName} · ${monthLabel(data.period)}*`,
    '',
    `Transaksi otomatis: ${data.earnedTrxCount} × ${formatRupiah(data.feePerTransaction)} = ${formatRupiah(data.autoEarned)}`,
  ];

  if (data.periodBonuses.length > 0) {
    lines.push(`Tambahan dari Superadmin: ${formatRupiah(data.bonusTotal)}`);
    data.periodBonuses.forEach((bonus) => lines.push(`  • ${bonus.notes}: ${formatRupiah(bonus.amount)}`));
  }

  lines.push(
    `*Total hak komisi: ${formatRupiah(data.totalEarned)}*`,
    `Sudah cair: ${formatRupiah(data.totalPaid)}`,
    `Belum cair: ${formatRupiah(data.pendingBalance)}`
  );
  return lines.join('\n');
}

/**
 * Keterangan cara hitung komisi yang ditampilkan ke admin (bahasa awam, sesuai aturan di atas).
 */
export function commissionRuleNotes({ feePerTransaction = 10000, usesStoreAttribution: storeAttribution = false } = {}) {
  const notes = [
    `Hak komisi = jumlah transaksi lunas atas akunmu × tarif Rp ${Math.floor(feePerTransaction).toLocaleString('id-ID')} per transaksi. Tarif ini ditetapkan Superadmin di Pengaturan.`,
    'Yang dihitung: transaksi berstatus LUNAS (retail) dan invoice instansi yang tercatat atas namamu.',
    'Yang tidak dihitung: transaksi belum lunas, transaksi Layanan CS, transaksi admin lain, dan transaksi Superadmin.',
    'Komisi dihitung per bulan: hanya transaksi pada bulan itu. Bulan yang berbeda tidak dijumlahkan di angka utama.',
    'Superadmin juga bisa memberi tambahan komisi untuk bulan tertentu. Nominalnya ditentukan Superadmin, ditambahkan ke hak komisi bulan itu, dan keterangannya tampil di bawah.',
    'Pencairan dilakukan Superadmin lewat transfer, dicatat untuk bulan yang dibayar, dan muncul di Riwayat. Belum cair = hak komisi bulan itu − yang sudah dicairkan untuk bulan itu.',
  ];
  if (storeAttribution) {
    notes.splice(2, 0, 'Untuk akun ini, transaksi kasir toko umum yang belum atas nama admin lain ikut dihitung.');
  }
  return notes;
}

/**
 * Membuat objek catatan transfer komisi baru. `period` ('YYYY-MM') = bulan komisi yang dibayar.
 */
export function createCommissionPayout({
  adminId,
  adminName,
  amount,
  paymentMethod = 'Transfer Bank',
  notes = '',
  sentByName = 'Super Admin',
  period = null,
}) {
  return {
    id: `COMM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    admin_id: adminId,
    admin_name: adminName,
    amount: Number(amount) || 0,
    payment_method: paymentMethod,
    notes: notes || 'Pencairan komisi jasa kasir',
    status: 'TERKIRIM',
    sent_by_name: sentByName,
    sent_at: new Date().toISOString(),
    ...(period ? { period } : {}),
  };
}

/**
 * Membuat catatan tambahan komisi (bonus) dari Superadmin untuk satu admin pada satu bulan ('YYYY-MM').
 */
export function createCommissionBonus({ adminId, adminName, amount, period, notes = '', givenByName = 'Super Admin' }) {
  return {
    id: `BONUS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    admin_id: adminId,
    admin_name: adminName,
    amount: Number(amount) || 0,
    period,
    notes: notes || 'Tambahan komisi dari Superadmin',
    given_by_name: givenByName,
    given_at: new Date().toISOString(),
  };
}

async function saveAllowedPaths(admin, payload) {
  const { error } = await supabase.from('admin_profiles').update({ allowed_paths: payload }).eq('id', admin.id);
  if (error) throw error;
  return payload;
}

/** Simpan tambahan komisi ke admin_profiles.allowed_paths (JSONB, sama seperti riwayat pencairan). */
export async function recordCommissionBonus(admin, bonusRecord) {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  return saveAllowedPaths(admin, { ...currentAccess, bonuses: [bonusRecord, ...(currentAccess.bonuses || [])] });
}

/**
 * Hapus satu catatan pencairan komisi (mis. salah input nominal atau transfer dibatalkan). Saldo belum cair
 * bulan itu otomatis bertambah lagi. Baris di tabel relasional admin_commissions (bila ada) ikut dihapus.
 */
export async function removeCommissionPayout(admin, payoutId) {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  const updated = await saveAllowedPaths(admin, {
    ...currentAccess,
    commissions: (currentAccess.commissions || []).filter((c) => c.id !== payoutId),
  });

  try {
    await supabase.from('admin_commissions').delete().eq('id', payoutId);
  } catch (err) {
    console.warn('Tabel admin_commissions belum aktif, hanya data hybrid JSONB yang dihapus:', err?.message);
  }

  return updated;
}

/** Batalkan (hapus) satu tambahan komisi, mis. karena salah input. */
export async function removeCommissionBonus(admin, bonusId) {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  return saveAllowedPaths(admin, { ...currentAccess, bonuses: (currentAccess.bonuses || []).filter((b) => b.id !== bonusId) });
}

/**
 * Simpan transfer komisi ke admin_profiles.allowed_paths (JSONB) dengan fallback aman.
 * Jika tabel relasional `admin_commissions` sudah tersedia di Supabase, data juga disimpan ke sana.
 */
export async function recordCommissionPayout(admin, payoutRecord) {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  const updatedCommissions = [payoutRecord, ...(currentAccess.commissions || [])];

  const updatedPayload = {
    ...currentAccess,
    commissions: updatedCommissions,
  };

  // 1. Update ke admin_profiles (selalu berhasil karena hybrid JSONB)
  const { error: profileError } = await supabase
    .from('admin_profiles')
    .update({ allowed_paths: updatedPayload })
    .eq('id', admin.id);

  if (profileError) throw profileError;

  // 2. Upaya opsional simpan ke tabel relasional admin_commissions jika tabel sudah ada
  try {
    await supabase.from('admin_commissions').insert({
      id: payoutRecord.id,
      admin_id: admin.id,
      admin_name: admin.full_name || payoutRecord.admin_name,
      amount: payoutRecord.amount,
      payment_method: payoutRecord.payment_method,
      notes: payoutRecord.notes,
      status: payoutRecord.status,
      sent_by_name: payoutRecord.sent_by_name,
      sent_at: payoutRecord.sent_at,
    });
  } catch (err) {
    // Ignored jika tabel belum dimigrasikan
    console.warn('Tabel admin_commissions belum aktif, data tersimpan di hybrid JSONB:', err?.message);
  }

  return updatedPayload;
}

/**
 * Menghitung ringkasan finansial dan kewajiban komisi toko untuk Superadmin:
 * - grossRevenue: Total omset penjualan lunas bulan ini
 * - totalCommissionLiability: Total komisi hak seluruh kasir/admin aktif bulan ini
 * - totalCommissionPaid: Total komisi yang sudah dicairkan ke kasir/admin
 * - pendingCommissionBalance: Sisa komisi yang belum dicairkan ke admin
 * - netStoreProfit: Estimasi keuntungan bersih toko setelah dikurangi hak komisi kasir
 * - activeAdminCount: Jumlah admin kasir aktif (non-superadmin)
 */
export function calculateStoreFinancialOverview(
  transactions = [], 
  accounts = [], 
  adminFee = 10000, 
  now = new Date()
) {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isCurrentMonthSuccess = (t) => {
    const rawDate = t.date || t.created_at;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    const inThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    const isPaid = t.status === 'LUNAS' || t.type === 'instansi';
    return inThisMonth && isPaid;
  };

  const monthlyTrx = transactions.filter(isCurrentMonthSuccess);
  const grossRevenue = monthlyTrx.reduce((sum, t) => sum + Number(t.price || 0), 0);
  const period = monthKey(now);

  // Hitung komisi untuk seluruh admin (kecuali superadmin)
  let totalCommissionLiability = 0;
  let totalCommissionPaid = 0;

  const adminAccounts = (accounts || []).filter(a => a.role !== 'superadmin');
  adminAccounts.forEach(admin => {
    const access = normalizeAdminAccess(admin.allowed_paths);
    const comm = calculateAdminCommissions(
      transactions,
      admin.id,
      admin.full_name,
      adminFee,
      access.commissions || [],
      admin.role,
      period,
      access.bonuses || []
    );
    totalCommissionLiability += comm.totalEarned;
    totalCommissionPaid += comm.totalPaid;
  });

  const pendingCommissionBalance = Math.max(0, totalCommissionLiability - totalCommissionPaid);
  const netStoreProfit = Math.max(0, grossRevenue - totalCommissionLiability);

  return {
    grossRevenue,
    totalCommissionLiability,
    totalCommissionPaid,
    pendingCommissionBalance,
    netStoreProfit,
    activeAdminCount: adminAccounts.length,
  };
}


