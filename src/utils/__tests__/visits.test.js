import { describe, it, expect } from 'vitest';
import { customerVisitStatus, pendingStops, formatShortDate, nextSevenDays, describeVisit, searchCustomers, TONE_COLORS, TONE_BADGE_CLASSES } from '../visits';

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

describe('nextSevenDays', () => {
  const days = nextSevenDays(new Date(2026, 8, 21)); // Senin 21 Sep 2026

  it('returns the seven days after today, starting with tomorrow', () => {
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ value: '2026-09-22', label: 'Besok' });
    expect(days[6].value).toBe('2026-09-28');
  });

  it('labels the other days with a short weekday and date', () => {
    expect(days[1].label).toBe('Rab 23 Sep');
    expect(days[6].label).toBe('Sen 28 Sep');
  });

  it('crosses month boundaries', () => {
    const endOfMonth = nextSevenDays(new Date(2026, 8, 29));
    expect(endOfMonth[0].value).toBe('2026-09-30');
    expect(endOfMonth[1].value).toBe('2026-10-01');
  });
});

describe('describeVisit', () => {
  it('describes a visit with its day, outcome and promised date', () => {
    expect(describeVisit({ visited_at: '2026-09-21T08:00:00', outcome: 'tidak_ada_di_rumah', available_on: '2026-09-22' }))
      .toBe('21 Sep · Tidak ada di rumah · kapan ada: 22 Sep');
  });

  it('omits the promised date when there is none', () => {
    expect(describeVisit({ visited_at: '2026-09-21T08:00:00', outcome: 'uang_belum_ada', available_on: null }))
      .toBe('21 Sep · Uang belum ada');
  });
});

describe('searchCustomers', () => {
  const list = [
    { id: '1', name: 'Budi Santoso', nickname: 'Mas Budi', address: 'Jl. Melati 2' },
    { id: '2', name: 'Citra Dewi', nickname: null, address: 'Jl. Kenanga 3' },
    { id: '3', name: 'Andi', nickname: null, address: null },
  ];

  it('returns everything for an empty query', () => {
    expect(searchCustomers(list, '')).toHaveLength(3);
    expect(searchCustomers(list, '   ')).toHaveLength(3);
  });

  it('matches name, nickname and address regardless of case', () => {
    expect(searchCustomers(list, 'budi').map((c) => c.id)).toEqual(['1']);
    expect(searchCustomers(list, 'MAS').map((c) => c.id)).toEqual(['1']);
    expect(searchCustomers(list, 'kenanga').map((c) => c.id)).toEqual(['2']);
  });

  it('returns nothing when there is no match', () => {
    expect(searchCustomers(list, 'zzz')).toEqual([]);
  });
});

describe('status colors', () => {
  const statusFor = (visits, trx = []) => customerVisitStatus(ani, visits, trx, now);

  it('is red when the house has not been visited yet', () => {
    expect(statusFor([]).tone).toBe('red');
  });

  it('is yellow when the customer was not at home', () => {
    expect(statusFor([visit({ outcome: 'tidak_ada_di_rumah' })]).tone).toBe('yellow');
  });

  it('is light blue when the customer has no money yet and promised a payment date', () => {
    expect(statusFor([visit({ outcome: 'uang_belum_ada', available_on: '2026-09-25' })]).tone).toBe('blue');
  });

  it('is green once the customer has paid', () => {
    const trx = [{ type: 'retail', status: 'LUNAS', customerName: 'Ani', date: '2026-09-03T10:00:00' }];
    expect(statusFor([visit()], trx).tone).toBe('green');
  });

  it('keeps the outcome colour when the promised date has arrived and a new visit is due', () => {
    const status = statusFor([visit({ visited_at: '2026-09-18T08:00:00', outcome: 'uang_belum_ada', available_on: '2026-09-21' })]);
    expect(status.key).toBe('perlu_didatangi');
    expect(status.tone).toBe('blue');
  });

  it('maps each tone to a map colour and a badge style', () => {
    expect(Object.keys(TONE_COLORS).sort()).toEqual(['blue', 'green', 'red', 'yellow']);
    expect(Object.keys(TONE_BADGE_CLASSES).sort()).toEqual(['blue', 'green', 'red', 'yellow']);
    expect(TONE_BADGE_CLASSES.yellow).toContain('yellow');
    expect(TONE_BADGE_CLASSES.blue).toContain('sky');
    expect(TONE_BADGE_CLASSES.green).toContain('emerald');
    expect(TONE_BADGE_CLASSES.red).toContain('red');
  });
});
