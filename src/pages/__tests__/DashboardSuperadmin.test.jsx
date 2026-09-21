import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

import DashboardSuperadmin from '../DashboardSuperadmin';
import Dashboard from '../Dashboard';

const now = new Date();
const thisMonth = (day) => new Date(now.getFullYear(), now.getMonth(), day, 10, 0, 0).toISOString();

const transactions = [
  { id: 't1', date: thisMonth(1), price: 150000, status: 'LUNAS', type: 'retail', customerName: 'Ani', cashier_name: 'Budi', payment_method: 'CASH' },
  { id: 't2', date: thisMonth(1), price: 250000, status: 'LUNAS', type: 'retail', customerName: 'Citra', cashier_name: 'Siti', payment_method: 'CASH' },
];
const customers = [
  { id: 'c1', name: 'Ani', status: 'aktif', package: 'Basic' },
  { id: 'c2', name: 'Budi', status: 'aktif', package: 'Basic' },
];
const packages = [{ id: 'p1', name: 'Basic', price: 150000 }];

// renderToString menyisipkan <!-- --> di antara node teks; buang agar assertion teks mudah dibaca.
const renderWithRouter = (element) => renderToString(<MemoryRouter>{element}</MemoryRouter>).replace(/<!-- -->/g, '');

describe('DashboardSuperadmin', () => {
  const html = renderWithRouter(
    <DashboardSuperadmin
      session={{ profile: { full_name: 'Super Administrator', role: 'superadmin' } }}
      transactions={transactions}
      customers={customers}
      packages={packages}
      companyInfo={{ adminName: 'CS PT NET.SI', adminFee: 10000 }}
    />
  );

  it('greets the superadmin by name', () => {
    expect(html).toContain('Halo, Super Administrator');
  });

  it('shows the superadmin-only sections', () => {
    expect(html).toContain('Performa Kasir');
    expect(html).toContain('Aktivitas Login Terbaru');
    expect(html).toContain('Detail Lengkap');
  });

  it('offers a daily revenue card with today, yesterday and date toggles', () => {
    expect(html).toContain('Pendapatan Harian');
    expect(html).toContain('Hari Ini');
    expect(html).toContain('Kemarin');
    expect(html).toContain('Pilih Tanggal');
  });

  it('shows a 7-day bookkeeping slider and a daily cash ledger toggle', () => {
    expect(html).toContain('Pembukuan 7 Hari Terakhir');
    expect(html).toContain('Buku kas harian');
    expect((html.match(/snap-start/g) || []).length).toBe(7);
  });

  it('ranks cashiers by revenue', () => {
    expect(html.indexOf('Siti')).toBeLessThan(html.indexOf('Budi'));
  });

  it('embeds the full dashboard without repeating its own greeting header', () => {
    expect(html).not.toContain('Halo, <span');
    expect(html).toContain('Pendapatan');
  });
});

describe('Dashboard (admin)', () => {
  it('shows a time-based greeting with the store admin name', () => {
    const html = renderWithRouter(
      <Dashboard transactions={transactions} customers={customers} packages={packages} companyInfo={{ adminName: 'CS PT NET.SI' }} />
    );
    expect(html).toMatch(/Selamat (pagi|siang|sore|malam)/);
    expect(html).toContain('CS PT NET.SI');
    expect(html).not.toContain('Performa Kasir');
  });
});
