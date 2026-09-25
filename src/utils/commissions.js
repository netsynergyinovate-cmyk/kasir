import { isOwnTransaction } from './dashboardStats';
import { supabase } from '../lib/supabase';
import { normalizeAdminAccess } from './permissions';

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

/**
 * Kalkulasi komisi admin:
 * - totalEarned: Jumlah transaksi lunas yang diproses admin * adminFee
 * - totalPaid: Total komisi yang sudah ditransfer oleh superadmin
 * - pendingBalance: Sisa komisi yang belum dicairkan (minimal 0)
 */
export function calculateAdminCommissions(
  transactions = [], 
  adminId = '', 
  adminName = '', 
  adminFee = 10000, 
  commissionHistory = [],
  adminRole = 'admin'
) {
  const feePerTransaction = Number(adminFee) || 10000;
  const matchingTrx = matchingCommissionTransactions(transactions, adminId, adminName, adminRole);
  const instansiCount = matchingTrx.filter((t) => t.type === 'instansi').length;

  const totalEarned = matchingTrx.length * feePerTransaction;
  const validHistory = Array.isArray(commissionHistory) ? commissionHistory : [];
  const totalPaid = validHistory
    .filter((c) => c.status === 'TERKIRIM')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const pendingBalance = Math.max(0, totalEarned - totalPaid);

  return {
    earnedTrxCount: matchingTrx.length,
    instansiCount,
    feePerTransaction,
    usesStoreAttribution: adminRole !== 'superadmin' && usesStoreAttribution(adminName),
    totalEarned,
    totalPaid,
    pendingBalance,
    history: validHistory,
  };
}

/**
 * Rincian hak komisi per bulan (terbaru dulu): berapa transaksi dihitung dan berapa rupiahnya.
 * Total semua bulan = totalEarned dari calculateAdminCommissions.
 */
export function commissionByMonth(transactions = [], adminId = '', adminName = '', adminFee = 10000, adminRole = 'admin') {
  const fee = Number(adminFee) || 10000;
  const buckets = new Map();

  matchingCommissionTransactions(transactions, adminId, adminName, adminRole).forEach((t) => {
    const rawDate = t.date || t.created_at;
    const date = rawDate ? new Date(rawDate) : null;
    const valid = date && !Number.isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';
    const label = valid ? `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` : 'Tanpa tanggal';
    const entry = buckets.get(key) || { key, label, count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += fee;
    buckets.set(key, entry);
  });

  return [...buckets.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

/**
 * Keterangan cara hitung komisi yang ditampilkan ke admin (bahasa awam, sesuai aturan di atas).
 */
export function commissionRuleNotes({ feePerTransaction = 10000, usesStoreAttribution: storeAttribution = false } = {}) {
  const notes = [
    `Hak komisi = jumlah transaksi lunas atas akunmu × tarif Rp ${Math.floor(feePerTransaction).toLocaleString('id-ID')} per transaksi. Tarif ini ditetapkan Superadmin di Pengaturan.`,
    'Yang dihitung: transaksi berstatus LUNAS (retail) dan invoice instansi yang tercatat atas namamu.',
    'Yang tidak dihitung: transaksi belum lunas, transaksi Layanan CS, transaksi admin lain, dan transaksi Superadmin.',
    'Angka ini akumulasi sejak awal, bukan per bulan. Rincian per bulan ada di bawah.',
    'Pencairan dilakukan Superadmin lewat transfer dan dicatat di Riwayat. Sisa belum cair = hak komisi − total yang sudah dicairkan.',
  ];
  if (storeAttribution) {
    notes.splice(2, 0, 'Untuk akun ini, transaksi kasir toko umum yang belum atas nama admin lain ikut dihitung.');
  }
  return notes;
}

/**
 * Membuat objek catatan transfer komisi baru.
 */
export function createCommissionPayout({
  adminId,
  adminName,
  amount,
  paymentMethod = 'Transfer Bank',
  notes = '',
  sentByName = 'Super Admin',
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
  };
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

  // Hitung komisi untuk seluruh admin (kecuali superadmin)
  let totalCommissionLiability = 0;
  let totalCommissionPaid = 0;

  const adminAccounts = (accounts || []).filter(a => a.role !== 'superadmin');
  adminAccounts.forEach(admin => {
    const access = normalizeAdminAccess(admin.allowed_paths);
    const comm = calculateAdminCommissions(
      monthlyTrx, 
      admin.id, 
      admin.full_name, 
      adminFee, 
      access.commissions || [],
      admin.role
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


