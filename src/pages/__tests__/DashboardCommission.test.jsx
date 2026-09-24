import { describe, it, expect } from 'vitest';
import { calculateAdminCommissions } from '../../utils/commissions';

describe('Dashboard Commission Integration', () => {
  it('computes commission data correctly for current session admin', () => {
    const transactions = [
      { id: '1', status: 'LUNAS', type: 'retail', price: 100000, cashier_id: 'adm-current' }
    ];
    const history = [
      { id: 'c1', amount: 10000, status: 'TERKIRIM', notes: 'Gaji Komisi', sent_at: new Date().toISOString() }
    ];

    const data = calculateAdminCommissions(transactions, 'adm-current', 'Kasir Saya', 10000, history);
    expect(data.totalEarned).toBe(10000);
    expect(data.totalPaid).toBe(10000);
    expect(data.pendingBalance).toBe(0);
    expect(data.history).toHaveLength(1);
    expect(data.history[0].status).toBe('TERKIRIM');
  });

  it('correctly tracks pending balance when earned exceeds paid', () => {
    const transactions = [
      { id: '1', status: 'LUNAS', type: 'retail', price: 100000, cashier_id: 'adm-current' },
      { id: '2', status: 'LUNAS', type: 'retail', price: 150000, cashier_id: 'adm-current' },
    ];
    const history = [
      { id: 'c1', amount: 10000, status: 'TERKIRIM' }
    ];

    const data = calculateAdminCommissions(transactions, 'adm-current', 'Kasir Saya', 10000, history);
    expect(data.totalEarned).toBe(20000);
    expect(data.totalPaid).toBe(10000);
    expect(data.pendingBalance).toBe(10000);
  });

  it('guarantees superadmin role receives 0 commission', () => {
    const transactions = [
      { id: '1', status: 'LUNAS', type: 'retail', price: 100000, cashier_name: 'Super Admin' },
      { id: '2', status: 'LUNAS', type: 'retail', price: 200000, cashier_name: 'Admin' },
    ];
    const data = calculateAdminCommissions(transactions, 'super-1', 'Super Admin', 10000, [], 'superadmin');
    expect(data.earnedTrxCount).toBe(0);
    expect(data.totalEarned).toBe(0);
    expect(data.pendingBalance).toBe(0);
  });

  it('correctly allocates 13 general store transactions to Admin Wahyu resulting in Rp 130.000', () => {
    const transactions = Array.from({ length: 13 }, (_, i) => ({
      id: `trx-${i}`,
      status: 'LUNAS',
      type: 'retail',
      cashier_name: i < 5 ? 'Wahyu' : 'Admin',
      payment_method: 'CASH',
    }));
    const data = calculateAdminCommissions(transactions, 'adm-wahyu', 'Admin Wahyu', 10000, [], 'admin');
    expect(data.earnedTrxCount).toBe(13);
    expect(data.totalEarned).toBe(130000);
    expect(data.pendingBalance).toBe(130000);
  });
});


