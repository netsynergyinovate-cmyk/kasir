import { describe, it, expect } from 'vitest';
import { customerVisitStatus, pendingStops, formatShortDate } from '../visits';

const now = new Date(2026, 8, 21, 10, 0); // 21 Sep 2026
const ani = { id: 'c1', name: 'Ani' };

const visit = (over) => ({
  customer_id: 'c1',
  visited_at: '2026-09-21T08:00:00',
  outcome: 'tidak_ada_di_rumah',
  available_on: null,
  ...over,
});

describe('formatShortDate', () => {
  it('formats yyyy-mm-dd as day and short month', () => {
    expect(formatShortDate('2026-09-25')).toBe('25 Sep');
    expect(formatShortDate(null)).toBe('');
  });
});

describe('customerVisitStatus', () => {
  it('marks a customer without visits as not yet visited', () => {
    expect(customerVisitStatus(ani, [], [], now)).toMatchObject({ key: 'belum_dikunjungi', label: 'Belum dikunjungi' });
  });

  it('marks a customer as paid when a paid retail transaction exists this month', () => {
    const trx = [{ type: 'retail', status: 'LUNAS', customerName: 'ani', date: '2026-09-03T10:00:00' }];
    const status = customerVisitStatus(ani, [visit()], trx, now);
    expect(status.key).toBe('sudah_bayar');
    expect(status.label).toBe('Sudah terbayarkan');
  });

  it('ignores payments from another month', () => {
    const trx = [{ type: 'retail', status: 'LUNAS', customerName: 'Ani', date: '2026-08-03T10:00:00' }];
    expect(customerVisitStatus(ani, [], trx, now).key).toBe('belum_dikunjungi');
  });

  it('waits when the customer was already visited today', () => {
    const status = customerVisitStatus(ani, [visit({ visited_at: '2026-09-21T08:00:00' })], [], now);
    expect(status.key).toBe('menunggu');
    expect(status.label).toBe('Tidak ada di rumah');
  });

  it('waits until the promised date and shows it in the label', () => {
    const status = customerVisitStatus(
      ani,
      [visit({ visited_at: '2026-09-18T08:00:00', outcome: 'uang_belum_ada', available_on: '2026-09-25' })],
      [],
      now,
    );
    expect(status.key).toBe('menunggu');
    expect(status.label).toBe('Uang belum ada · kapan ada: 25 Sep');
  });

  it('needs a new visit once the promised date has arrived', () => {
    const status = customerVisitStatus(
      ani,
      [visit({ visited_at: '2026-09-18T08:00:00', available_on: '2026-09-21' })],
      [],
      now,
    );
    expect(status.key).toBe('perlu_didatangi');
  });

  it('needs a new visit when an earlier visit has no promised date', () => {
    const status = customerVisitStatus(ani, [visit({ visited_at: '2026-09-18T08:00:00' })], [], now);
    expect(status.key).toBe('perlu_didatangi');
  });

  it('uses the most recent visit of this month and ignores other customers and months', () => {
    const visits = [
      visit({ visited_at: '2026-09-10T08:00:00', outcome: 'uang_belum_ada' }),
      visit({ visited_at: '2026-09-19T08:00:00', outcome: 'tidak_ada_di_rumah' }),
      visit({ customer_id: 'other', visited_at: '2026-09-20T08:00:00', outcome: 'uang_belum_ada' }),
      visit({ visited_at: '2026-08-30T08:00:00', outcome: 'uang_belum_ada' }),
    ];
    expect(customerVisitStatus(ani, visits, [], now).label).toBe('Tidak ada di rumah');
  });
});

describe('pendingStops', () => {
  it('keeps the route order and only the customers that still need a visit', () => {
    const stops = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const statuses = {
      a: { key: 'sudah_bayar' },
      b: { key: 'menunggu' },
      c: { key: 'perlu_didatangi' },
      d: { key: 'belum_dikunjungi' },
    };
    expect(pendingStops(stops, statuses).map((s) => s.id)).toEqual(['c', 'd']);
  });
});
