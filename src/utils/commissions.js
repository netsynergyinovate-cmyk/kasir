import { isOwnTransaction } from './dashboardStats';
import { supabase } from '../lib/supabase';
import { normalizeAdminAccess } from './permissions';

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
  // Superadmin tidak pernah mendapatkan komisi
  if (adminRole === 'superadmin') {
    return {
      earnedTrxCount: 0,
      totalEarned: 0,
      totalPaid: 0,
      pendingBalance: 0,
      history: [],
    };
  }

  const isWahyu = (adminName || '').toLowerCase().includes('wahyu');

  const matchingTrx = transactions.filter((t) => {
    const isPaid = t.status === 'LUNAS' || t.type === 'instansi';
    const isCS = t.payment_method === 'CS' || 
                 (t.cashier_name || '').toLowerCase().includes('cs') ||
                 (t.cashierName || '').toLowerCase().includes('cs');
    if (!isPaid || isCS) return false;

    // Jika admin adalah Wahyu, sertakan transaksi kasir umum / toko yang belum spesifik
    if (isWahyu) {
      const isSpecificOtherAdmin = t.cashier_id && t.cashier_id !== adminId && 
                                   t.cashier_name && !t.cashier_name.toLowerCase().includes('wahyu') &&
                                   !t.cashier_name.toLowerCase().includes('admin');
      if (isSpecificOtherAdmin) return false;
      return true;
    }

    return isOwnTransaction(t, adminId, adminName);
  });

  const totalEarned = matchingTrx.length * (Number(adminFee) || 10000);
  const validHistory = Array.isArray(commissionHistory) ? commissionHistory : [];
  const totalPaid = validHistory
    .filter((c) => c.status === 'TERKIRIM')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const pendingBalance = Math.max(0, totalEarned - totalPaid);

  return {
    earnedTrxCount: matchingTrx.length,
    totalEarned,
    totalPaid,
    pendingBalance,
    history: validHistory,
  };
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


