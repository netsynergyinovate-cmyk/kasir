import { describe, it, expect } from 'vitest';
import { getGreeting, percentChange, compareMonths, cashierPerformance, formatRelativeTime, paymentSummary, dailyStats, compareDays, resolveDay, methodBreakdown, dailyTransactions, toInputValue, isOwnTransaction } from '../dashboardStats';

describe('getGreeting', () => {
  it('returns the Indonesian greeting for each part of the day', () => {
    expect(getGreeting(5)).toBe('Selamat pagi');
    expect(getGreeting(10)).toBe('Selamat pagi');
    expect(getGreeting(12)).toBe('Selamat siang');
    expect(getGreeting(16)).toBe('Selamat sore');
    expect(getGreeting(20)).toBe('Selamat malam');
    expect(getGreeting(2)).toBe('Selamat malam');
  });
});

describe('percentChange', () => {
  it('computes a rounded percentage change', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
  });

  it('returns null when there is no previous value to compare with', () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it('returns 0 when both values are zero', () => {
    expect(percentChange(0, 0)).toBe(0);
  });
});

const trx = (date, price, extra = {}) => ({ date, price, status: 'LUNAS', type: 'retail', cashier_name: 'Budi', ...extra });

describe('compareMonths', () => {
  const now = new Date(2026, 8, 21); // 21 Sep 2026
  const transactions = [
    trx('2026-09-05T10:00:00', 100000),
    trx('2026-09-10T10:00:00', 50000),
    trx('2026-08-20T10:00:00', 100000),
    trx('2026-07-01T10:00:00', 999999),
  ];

  it('sums revenue and counts successful transactions for this and the previous month', () => {
    const result = compareMonths(transactions, now);
    expect(result.current).toEqual({ revenue: 150000, count: 2 });
    expect(result.previous).toEqual({ revenue: 100000, count: 1 });
    expect(result.revenueChange).toBe(50);
    expect(result.countChange).toBe(100);
  });

  it('handles January by comparing with December of the previous year', () => {
    const jan = new Date(2027, 0, 15);
    const result = compareMonths([trx('2026-12-20T10:00:00', 40000), trx('2027-01-02T10:00:00', 80000)], jan);
    expect(result.previous.revenue).toBe(40000);
    expect(result.revenueChange).toBe(100);
  });

  it('leaves unpaid retail transactions out of both revenue and count', () => {
    const result = compareMonths([trx('2026-09-05T10:00:00', 10000, { status: 'PENDING' })], now);
    expect(result.current).toEqual({ revenue: 0, count: 0 });
  });

  it('counts instansi invoices as revenue', () => {
    const result = compareMonths([trx('2026-09-05T10:00:00', 500000, { type: 'instansi', status: 'BELUM' })], now);
    expect(result.current).toEqual({ revenue: 500000, count: 1 });
  });
});

describe('cashierPerformance', () => {
  it('groups successful transactions by cashier, highest revenue first', () => {
    const list = [
      trx('2026-09-05T10:00:00', 100000, { cashier_name: 'Budi' }),
      trx('2026-09-06T10:00:00', 300000, { cashier_name: 'Siti' }),
      trx('2026-09-07T10:00:00', 50000, { cashier_name: 'Budi' }),
      trx('2026-08-07T10:00:00', 900000, { cashier_name: 'Siti' }),
      trx('2026-09-08T10:00:00', 70000, { cashier_name: 'Budi', status: 'PENDING' }),
    ];
    expect(cashierPerformance(list, 2026, 8)).toEqual([
      { name: 'Siti', count: 1, revenue: 300000 },
      { name: 'Budi', count: 2, revenue: 150000 },
    ]);
  });

  it('labels transactions without a cashier name', () => {
    const list = [trx('2026-09-05T10:00:00', 10000, { cashier_name: null })];
    expect(cashierPerformance(list, 2026, 8)[0].name).toBe('Tidak diketahui');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-21T12:00:00');

  it('returns a placeholder when there is no timestamp', () => {
    expect(formatRelativeTime(null, now)).toBe('Belum pernah login');
  });

  it('formats minutes, hours and days in Indonesian', () => {
    expect(formatRelativeTime('2026-09-21T11:59:40', now)).toBe('Baru saja');
    expect(formatRelativeTime('2026-09-21T11:35:00', now)).toBe('25 menit lalu');
    expect(formatRelativeTime('2026-09-21T09:00:00', now)).toBe('3 jam lalu');
    expect(formatRelativeTime('2026-09-18T12:00:00', now)).toBe('3 hari lalu');
  });
});

describe('paymentSummary', () => {
  const now = new Date(2026, 8, 21);
  const customers = [
    { name: 'Ani', status: 'aktif' },
    { name: 'Budi', status: 'aktif' },
    { name: 'Citra', status: 'nonaktif' },
  ];

  it('counts active customers who have and have not paid this month', () => {
    const transactions = [
      { type: 'retail', status: 'LUNAS', customerName: 'ani', date: '2026-09-03T10:00:00' },
      { type: 'retail', status: 'LUNAS', customerName: 'Budi', date: '2026-08-03T10:00:00' },
    ];
    expect(paymentSummary(customers, transactions, now)).toEqual({ active: 2, paid: 1, unpaid: 1 });
  });
});

describe('dailyStats', () => {
  const list = [
    trx('2026-09-20T08:00:00', 100000),
    trx('2026-09-20T23:59:00', 50000),
    trx('2026-09-21T00:01:00', 70000),
    trx('2026-09-20T10:00:00', 30000, { status: 'PENDING' }),
  ];

  it('sums revenue for the given calendar day and counts successful transactions', () => {
    expect(dailyStats(list, new Date(2026, 8, 20))).toEqual({ revenue: 150000, count: 2 });
    expect(dailyStats(list, new Date(2026, 8, 21))).toEqual({ revenue: 70000, count: 1 });
  });

  it('returns zeros for a day without transactions', () => {
    expect(dailyStats(list, new Date(2026, 8, 19))).toEqual({ revenue: 0, count: 0 });
  });
});

describe('compareDays', () => {
  it('compares a day with the day before it', () => {
    const list = [trx('2026-09-20T08:00:00', 100000), trx('2026-09-21T08:00:00', 150000)];
    const result = compareDays(list, new Date(2026, 8, 21));
    expect(result.current.revenue).toBe(150000);
    expect(result.previous.revenue).toBe(100000);
    expect(result.revenueChange).toBe(50);
  });

  it('crosses month boundaries', () => {
    const list = [trx('2026-08-31T08:00:00', 40000), trx('2026-09-01T08:00:00', 20000)];
    const result = compareDays(list, new Date(2026, 8, 1));
    expect(result.previous.revenue).toBe(40000);
    expect(result.revenueChange).toBe(-50);
  });
});

describe('resolveDay', () => {
  const now = new Date(2026, 8, 21, 15, 30);

  it('resolves today and yesterday', () => {
    expect(resolveDay('today', now).getDate()).toBe(21);
    expect(resolveDay('yesterday', now).getDate()).toBe(20);
  });

  it('resolves a custom yyyy-mm-dd value as a local calendar day', () => {
    const day = resolveDay('custom', now, '2026-09-05');
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 8, 5]);
  });

  it('falls back to today for an empty custom value', () => {
    expect(resolveDay('custom', now, '').getDate()).toBe(21);
  });
});

describe('toInputValue', () => {
  it('formats a date as yyyy-mm-dd in local time', () => {
    expect(toInputValue(new Date(2026, 8, 5))).toBe('2026-09-05');
    expect(toInputValue(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('methodBreakdown', () => {
  const day = new Date(2026, 8, 21);
  const list = [
    trx('2026-09-21T09:00:00', 100000, { payment_method: 'CASH' }),
    trx('2026-09-21T10:00:00', 50000, { payment_method: 'TRANSFER' }),
    trx('2026-09-21T11:00:00', 25000, { payment_method: 'CASH' }),
    trx('2026-09-21T12:00:00', 10000, { payment_method: null }),
    trx('2026-09-21T13:00:00', 99000, { payment_method: 'CASH', status: 'PENDING' }),
    trx('2026-09-20T13:00:00', 88000, { payment_method: 'CASH' }),
  ];

  it('groups a day by payment method, highest revenue first, ignoring unpaid and other days', () => {
    expect(methodBreakdown(list, day)).toEqual([
      { method: 'CASH', count: 2, revenue: 125000 },
      { method: 'TRANSFER', count: 1, revenue: 50000 },
      { method: 'Tidak dicatat', count: 1, revenue: 10000 },
    ]);
  });
});

describe('dailyTransactions', () => {
  it('lists the successful transactions of a day, earliest first', () => {
    const list = [
      trx('2026-09-21T11:00:00', 2, { id: 'b' }),
      trx('2026-09-21T09:00:00', 1, { id: 'a' }),
      trx('2026-09-21T10:00:00', 9, { id: 'x', status: 'PENDING' }),
      trx('2026-09-20T09:00:00', 3, { id: 'y' }),
    ];
    expect(dailyTransactions(list, new Date(2026, 8, 21)).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('isOwnTransaction', () => {
  it('matches by cashierId when the transaction has one (robust to name changes)', () => {
    expect(isOwnTransaction({ cashierId: 'u1', cashierName: 'Old Name' }, 'u1', 'New Name')).toBe(true);
    expect(isOwnTransaction({ cashierId: 'u2' }, 'u1', 'Budi')).toBe(false);
  });

  it('reads the snake_case form too (transactions loaded from the database)', () => {
    expect(isOwnTransaction({ cashier_id: 'u1' }, 'u1', 'Budi')).toBe(true);
  });

  it('falls back to matching the cashier name for old transactions with no cashierId at all', () => {
    expect(isOwnTransaction({ cashierName: 'Budi' }, 'u1', 'Budi')).toBe(true);
    expect(isOwnTransaction({ cashier_name: 'Budi' }, 'u1', 'Budi')).toBe(true);
    expect(isOwnTransaction({ cashierName: 'Super Administrator' }, 'u1', 'Budi')).toBe(false);
  });

  it('never counts a transaction as this admin\'s own when it has neither cashierId nor a matching name (e.g. done by superadmin)', () => {
    expect(isOwnTransaction({ cashierName: 'Super Administrator' }, 'u1', null)).toBe(false);
  });
});
