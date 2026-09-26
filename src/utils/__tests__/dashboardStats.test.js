import { describe, it, expect } from 'vitest';
import { getGreeting, percentChange, compareMonths, cashierPerformance, formatRelativeTime, paymentSummary, dailyStats, compareDays, resolveDay, methodBreakdown, dailyTransactions, toInputValue, isOwnTransaction, weeklyRevenue, projectMonthRevenue, daysInMonth, paymentBreakdown, kasbonSummary, isEffectivelyKasbon } from '../dashboardStats';

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

describe('kasbonSummary', () => {
  it('sums the shortfall (price - amountPaid) of KASBON retail transactions only', () => {
    const transactions = [
      trx('2026-09-05T10:00:00', 250000, { status: 'KASBON', amountPaid: 200000 }),
      trx('2026-09-06T10:00:00', 200000, { status: 'KASBON', amountPaid: 0 }),
      trx('2026-09-07T10:00:00', 250000, { status: 'LUNAS', amountPaid: 250000 }),
      trx('2026-09-08T10:00:00', 100000, { status: 'KASBON', amountPaid: 100000, type: 'instansi' }),
    ];
    expect(kasbonSummary(transactions)).toEqual({ count: 2, shortfall: 250000 });
  });

  it('never counts a negative shortfall as debt (overpaid KASBON, e.g. manual override)', () => {
    const transactions = [trx('2026-09-05T10:00:00', 200000, { status: 'KASBON', amountPaid: 250000 })];
    expect(kasbonSummary(transactions)).toEqual({ count: 1, shortfall: 0 });
  });

  it('returns zero for an empty or all-LUNAS list', () => {
    expect(kasbonSummary([])).toEqual({ count: 0, shortfall: 0 });
    expect(kasbonSummary([trx('2026-09-05T10:00:00', 200000)])).toEqual({ count: 0, shortfall: 0 });
  });

  it('also counts an OLD transaction stored as LUNAS but actually underpaid (before the auto-KASBON feature existed)', () => {
    const transactions = [trx('2026-09-05T10:00:00', 200000, { status: 'LUNAS', amountPaid: 100000 })];
    expect(kasbonSummary(transactions)).toEqual({ count: 1, shortfall: 100000 });
  });
});

describe('isEffectivelyKasbon', () => {
  it('flags a retail transaction underpaid even when its stored status still says LUNAS', () => {
    expect(isEffectivelyKasbon(trx('2026-09-05T10:00:00', 200000, { amountPaid: 100000 }))).toBe(true);
  });

  it('trusts the stored KASBON status even if amountPaid happens to equal the price', () => {
    expect(isEffectivelyKasbon(trx('2026-09-05T10:00:00', 200000, { status: 'KASBON', amountPaid: 200000 }))).toBe(true);
  });

  it('is false for a fully paid LUNAS transaction', () => {
    expect(isEffectivelyKasbon(trx('2026-09-05T10:00:00', 200000, { amountPaid: 200000 }))).toBe(false);
  });

  it('ignores a CS adjustment even if its recorded amountPaid looks short', () => {
    expect(isEffectivelyKasbon(trx('2026-09-05T10:00:00', 200000, { amountPaid: 0, payment_method: 'CS' }))).toBe(false);
  });

  it('ignores instansi invoices (not a retail package payment)', () => {
    expect(isEffectivelyKasbon(trx('2026-09-05T10:00:00', 200000, { amountPaid: 100000, type: 'instansi' }))).toBe(false);
  });

  it('treats a missing amountPaid as fully paid (cannot retroactively assume debt with no data)', () => {
    expect(isEffectivelyKasbon(trx('2026-09-05T10:00:00', 200000, { amountPaid: undefined }))).toBe(false);
  });
});

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

describe('weeklyRevenue', () => {
  it('returns one entry per day for the last N days, oldest first, ending at endDate', () => {
    const list = [
      trx('2026-09-19T10:00:00', 100000),
      trx('2026-09-21T10:00:00', 50000),
      trx('2026-09-21T12:00:00', 25000),
    ];
    const result = weeklyRevenue(list, new Date(2026, 8, 21), 3);
    expect(result.map((r) => r.date.getDate())).toEqual([19, 20, 21]);
    expect(result.map((r) => r.revenue)).toEqual([100000, 0, 75000]);
    expect(result.map((r) => r.count)).toEqual([1, 0, 2]);
  });

  it('defaults to 7 days', () => {
    expect(weeklyRevenue([], new Date(2026, 8, 21))).toHaveLength(7);
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

describe('projectMonthRevenue & daysInMonth', () => {
  it('projects month-end revenue from the daily run-rate', () => {
    // hari ke-10 dari 30 hari: 1jt terkumpul, laju 100rb/hari => 3jt
    expect(projectMonthRevenue(1000000, new Date(2026, 8, 10))).toBe(3000000);
    expect(daysInMonth(new Date(2026, 1, 5))).toBe(28);
    expect(daysInMonth(new Date(2028, 1, 5))).toBe(29);
  });

  it('returns 0 for a month with no revenue yet', () => {
    expect(projectMonthRevenue(0, new Date(2026, 8, 1))).toBe(0);
  });
});

describe('paymentBreakdown', () => {
  const now = new Date(2026, 8, 24, 10, 0, 0);
  const thisMonth = new Date(2026, 8, 3, 10, 0, 0).toISOString();
  const lastMonth = new Date(2026, 7, 3, 10, 0, 0).toISOString();
  const customers = [
    { id: 'a', name: 'Ani', status: 'aktif', price: 200000 },
    { id: 'b', name: 'Budi', status: 'aktif', package: 'Home 20M' },
    { id: 'c', name: 'Citra', status: 'aktif', price: 150000 },
    { id: 'd', name: 'Dedi', status: 'isolir', price: 999000 },
  ];
  const packages = [{ name: 'Home 20M', price: 250000 }];
  const transactions = [
    { type: 'retail', status: 'LUNAS', customerName: 'ani', price: 200000, date: thisMonth },
    { type: 'retail', status: 'LUNAS', customerName: 'Citra', price: 150000, date: lastMonth },
    { type: 'retail', status: 'LUNAS', customerName: 'Dedi', price: 999000, date: thisMonth },
  ];

  it('counts only active customers and matches names case-insensitively', () => {
    const result = paymentBreakdown(customers, transactions, packages, now);
    expect(result.active).toBe(3);
    expect(result.paid).toBe(1);
    expect(result.unpaid).toBe(2);
    expect(result.paidPercent).toBe(33);
  });

  it('sums paid amount for active customers only (isolir payments are not counted)', () => {
    expect(paymentBreakdown(customers, transactions, packages, now).paidAmount).toBe(200000);
  });

  it('sums unpaid amount using customer price, falling back to package price', () => {
    // Budi: harga paket 250rb, Citra: bayar bulan lalu saja => 150rb
    expect(paymentBreakdown(customers, transactions, packages, now).unpaidAmount).toBe(400000);
  });

  it('handles no active customers', () => {
    expect(paymentBreakdown([], [], [], now)).toEqual({ active: 0, paid: 0, unpaid: 0, paidPercent: 0, paidAmount: 0, unpaidAmount: 0 });
  });
});
