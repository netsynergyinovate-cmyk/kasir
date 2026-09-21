import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import VisitModal from '../VisitModal';

const html = renderToString(<VisitModal customer={{ id: 'c1', name: 'Ani Pelanggan' }} onClose={() => {}} onSave={() => {}} />).replace(/<!-- -->/g, '');

describe('VisitModal', () => {
  it('offers exactly seven day toggles starting with tomorrow instead of a free date picker', () => {
    expect((html.match(/data-day-chip/g) || []).length).toBe(7);
    expect(html).toContain('Besok');
    expect(html).not.toContain('type="date"');
  });

  it('records both outcomes and asks when the customer will be available', () => {
    expect(html).toContain('Tidak ada di rumah');
    expect(html).toContain('Uang belum ada');
    expect(html).toContain('Kapan ada di rumah?');
  });

  it('reminds the admin to update the information on the next visit', () => {
    expect(html).toMatch(/didatangi lagi/);
  });

  it('shows who the visit is for', () => {
    expect(html).toContain('Ani Pelanggan');
  });
});
