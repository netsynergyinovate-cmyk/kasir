import { describe, it, expect } from 'vitest';
import { 
  calculateAdminCommissions, 
  createCommissionPayout 
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
