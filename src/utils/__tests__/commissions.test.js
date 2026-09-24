import { describe, it, expect } from 'vitest';
import { 
  calculateAdminCommissions, 
  createCommissionPayout,
  calculateStoreFinancialOverview
} from '../commissions';

describe('calculateAdminCommissions', () => {
  const transactions = [
    { id: 't1', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-1', cashier_name: 'Budi' },
    { id: 't2', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-1', cashier_name: 'Budi' },
    { id: 't3', status: 'LUNAS', type: 'retail', payment_method: 'CS', cashier_id: 'adm-1', cashier_name: 'Budi' }, // CS excluded
    { id: 't4', status: 'PENDING', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-1', cashier_name: 'Budi' }, // Unpaid excluded
    { id: 't5', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-2', cashier_name: 'Siti' }, // Other admin
  ];

  it('calculates total earned, paid, and pending accurately', () => {
    const history = [
      { id: 'c1', amount: 10000, status: 'TERKIRIM' },
    ];
    const result = calculateAdminCommissions(transactions, 'adm-1', 'Budi', 10000, history);
    
    expect(result.earnedTrxCount).toBe(2);
    expect(result.totalEarned).toBe(20000);
    expect(result.totalPaid).toBe(10000);
    expect(result.pendingBalance).toBe(10000);
    expect(result.history).toHaveLength(1);
  });

  it('handles zero commission history gracefully', () => {
    const result = calculateAdminCommissions(transactions, 'adm-1', 'Budi', 5000, []);
    expect(result.totalEarned).toBe(10000);
    expect(result.totalPaid).toBe(0);
    expect(result.pendingBalance).toBe(10000);
  });

  it('handles empty transactions', () => {
    const result = calculateAdminCommissions([], 'adm-1', 'Budi', 10000, []);
    expect(result.earnedTrxCount).toBe(0);
    expect(result.totalEarned).toBe(0);
    expect(result.pendingBalance).toBe(0);
  });

  it('handles instansi type transactions', () => {
    const instansiTrx = [
      { id: 'i1', status: 'PENDING', type: 'instansi', payment_method: 'TRANSFER', cashier_id: 'adm-1' },
    ];
    const result = calculateAdminCommissions(instansiTrx, 'adm-1', 'Budi', 10000, []);
    expect(result.earnedTrxCount).toBe(1);
    expect(result.totalEarned).toBe(10000);
  });
  it('returns 0 commission for superadmin role regardless of transactions', () => {
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', price: 100000, cashier_name: 'Super Admin' }
    ];
    const result = calculateAdminCommissions(transactions, 'super-1', 'Super Admin', 10000, [], 'superadmin');
    expect(result.earnedTrxCount).toBe(0);
    expect(result.totalEarned).toBe(0);
    expect(result.pendingBalance).toBe(0);
  });

  it('excludes CS transactions and CS cashier from commission calculation', () => {
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', price: 100000, payment_method: 'CS', cashier_name: 'Wahyu' },
      { id: 't2', status: 'LUNAS', type: 'retail', price: 100000, payment_method: 'CASH', cashier_name: 'CS NET.SI' },
      { id: 't3', status: 'LUNAS', type: 'retail', price: 100000, payment_method: 'CASH', cashier_name: 'Wahyu' }
    ];
    const result = calculateAdminCommissions(transactions, 'adm-wahyu', 'Wahyu', 10000, [], 'admin');
    expect(result.earnedTrxCount).toBe(1);
    expect(result.totalEarned).toBe(10000);
  });

  it('attributes general store cashier transactions to Admin Wahyu', () => {
    // 13 retail transactions without specific cashier_id or with Wahyu / Admin
    const transactions = Array.from({ length: 13 }, (_, i) => ({
      id: `trx-${i}`,
      status: 'LUNAS',
      type: 'retail',
      payment_method: 'CASH',
      cashier_name: i < 5 ? 'Wahyu' : 'Admin'
    }));
    const result = calculateAdminCommissions(transactions, 'adm-wahyu', 'Wahyu', 10000, [], 'admin');
    expect(result.earnedTrxCount).toBe(13);
    expect(result.totalEarned).toBe(130000);
    expect(result.pendingBalance).toBe(130000);
  });

  it('does not attribute other specific admins transactions to Wahyu', () => {
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-budi', cashier_name: 'Budi' },
      { id: 't2', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_name: 'Wahyu' },
    ];
    const resultWahyu = calculateAdminCommissions(transactions, 'adm-wahyu', 'Wahyu', 10000, [], 'admin');
    expect(resultWahyu.earnedTrxCount).toBe(1);

    const resultBudi = calculateAdminCommissions(transactions, 'adm-budi', 'Budi', 10000, [], 'admin');
    expect(resultBudi.earnedTrxCount).toBe(1);
  });
});

describe('createCommissionPayout', () => {
  it('creates valid commission payout entry with required fields', () => {
    const payout = createCommissionPayout({
      adminId: 'adm-1',
      adminName: 'Budi',
      amount: 50000,
      paymentMethod: 'Transfer Bank (BCA)',
      notes: 'Komisi September 2026',
      sentByName: 'CS NET.SI'
    });

    expect(payout.id).toMatch(/^COMM-/);
    expect(payout.admin_id).toBe('adm-1');
    expect(payout.admin_name).toBe('Budi');
    expect(payout.amount).toBe(50000);
    expect(payout.payment_method).toBe('Transfer Bank (BCA)');
    expect(payout.notes).toBe('Komisi September 2026');
    expect(payout.status).toBe('TERKIRIM');
    expect(payout.sent_by_name).toBe('CS NET.SI');
    expect(payout.sent_at).toBeDefined();
  });

  it('provides default values for optional fields', () => {
    const payout = createCommissionPayout({
      adminId: 'adm-2',
      adminName: 'Siti',
      amount: 25000,
    });

    expect(payout.payment_method).toBe('Transfer Bank');
    expect(payout.notes).toBe('Pencairan komisi jasa kasir');
    expect(payout.sent_by_name).toBe('Super Admin');
  });
});

describe('calculateStoreFinancialOverview', () => {
  it('calculates gross revenue, total admin commission liabilities, and net profit', () => {
    const now = new Date('2026-09-24T12:00:00Z');
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', price: 200000, cashier_name: 'Wahyu', date: '2026-09-20T10:00:00Z' },
      { id: 't2', status: 'LUNAS', type: 'retail', price: 150000, payment_method: 'CS', cashier_name: 'CS', date: '2026-09-21T10:00:00Z' },
      { id: 't3', status: 'LUNAS', type: 'retail', price: 250000, cashier_id: 'adm-budi', cashier_name: 'Budi', date: '2026-09-22T10:00:00Z' },
    ];
    const accounts = [
      { id: 'adm-wahyu', full_name: 'Wahyu', role: 'admin', allowed_paths: { commissions: [{ amount: 10000, status: 'TERKIRIM' }] } },
      { id: 'adm-budi', full_name: 'Budi', role: 'admin', allowed_paths: { commissions: [] } },
      { id: 'super-1', full_name: 'Owner', role: 'superadmin' }
    ];

    const overview = calculateStoreFinancialOverview(transactions, accounts, 10000, now);
    expect(overview.grossRevenue).toBe(600000);
    expect(overview.totalCommissionLiability).toBe(20000); // Wahyu (1) + Budi (1), CS (0)
    expect(overview.totalCommissionPaid).toBe(10000);
    expect(overview.pendingCommissionBalance).toBe(10000);
    expect(overview.netStoreProfit).toBe(580000);
    expect(overview.activeAdminCount).toBe(2);
  });
});



