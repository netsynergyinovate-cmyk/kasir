import { describe, it, expect } from 'vitest';
import { getGreeting, percentChange, compareMonths, cashierPerformance, formatRelativeTime, paymentSummary } from '../dashboardStats';

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

  it('does not count unpaid retail transactions in the count', () => {
    const result = compareMonths([trx('2026-09-05T10:00:00', 10000, { status: 'PENDING' })], now);
    expect(result.current.count).toBe(0);
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
