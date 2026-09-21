import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import VisitModal from '../VisitModal';

const render = (props = {}) => renderToString(
  <VisitModal customer={{ id: 'c1', name: 'Ani Pelanggan' }} onClose={() => {}} onSave={() => {}} {...props} />
).replace(/<!-- -->/g, '');

describe('VisitModal when the customer was not at home', () => {
  const html = render();

  it('records it for that day only, with no date to choose', () => {
    expect((html.match(/data-day-chip/g) || []).length).toBe(0);
    expect(html).not.toContain('type="date"');
    expect(html).toContain('Dicatat untuk hari ini');
  });

  it('tells the admin the house comes back as a destination and to update it on the next visit', () => {
    expect(html).toMatch(/didatangi lagi/);
  });

  it('offers both outcomes and shows who the visit is for', () => {
    expect(html).toContain('Tidak ada di rumah');
    expect(html).toContain('Ada di rumah, uang belum ada');
    expect(html).toContain('Ani Pelanggan');
  });
});

describe('VisitModal when the customer is home but has no money yet', () => {
  const html = render({ initialOutcome: 'uang_belum_ada' });

  it('offers exactly seven day toggles starting with tomorrow instead of a free date picker', () => {
    expect((html.match(/data-day-chip/g) || []).length).toBe(7);
    expect(html).toContain('Besok');
    expect(html).not.toContain('type="date"');
  });

  it('asks when the money will be there and mentions the automatic paid status', () => {
    expect(html).toContain('Kapan uangnya ada?');
    expect(html).toContain('Sudah terbayarkan');
  });
});
