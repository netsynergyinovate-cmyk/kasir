import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => {
  const result = Promise.resolve({ data: [], error: null });
  const chain = { order: () => chain, limit: () => result, then: (...args) => result.then(...args) };
  return { supabase: { from: () => ({ select: () => chain }) } };
});

import DashboardSuperadmin from '../DashboardSuperadmin';

const now = new Date();
const monthLabels = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const at = (monthOffset, day, hour = 10) => new Date(now.getFullYear(), now.getMonth() + monthOffset, day, hour, 0, 0).toISOString();

const transactions = [
  { id: 't1', date: at(0, 1), price: 200000, status: 'LUNAS', type: 'retail', customerName: 'Ani', cashier_name: 'Budi', payment_method: 'CASH' },
  { id: 't2', date: at(-1, 5), price: 300000, status: 'LUNAS', type: 'retail', customerName: 'Citra', cashier_name: 'Siti', payment_method: 'CASH' },
];
const customers = [
  { id: 'c1', name: 'Ani', status: 'aktif', price: 200000 },
  { id: 'c2', name: 'Citra', status: 'aktif', price: 300000 },
];

describe('DashboardSuperadmin interactions', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderDashboard = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DashboardSuperadmin
            session={{ profile: { full_name: 'Super Administrator', role: 'superadmin' } }}
            transactions={transactions}
            customers={customers}
            packages={[]}
            companyInfo={{ adminFee: 10000 }}
          />
        </MemoryRouter>
      );
    });
  };

  const findButton = (text) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent.trim() === text);
  const click = async (el) => { await act(async () => { el.click(); }); };

  it('starts with quick actions collapsed and toggles them open', async () => {
    await renderDashboard();
    const header = Array.from(container.querySelectorAll('button[aria-expanded]')).find((b) => b.textContent.includes('Aksi Cepat'));
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(header.textContent).toContain('Buka');

    await click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(header.textContent).toContain('Tutup');
  });

  it('switches the executive summary to last month figures', async () => {
    await renderDashboard();
    const thisMonth = `${monthLabels[now.getMonth()]} ${now.getFullYear()}`;
    const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${monthLabels[lastDate.getMonth()]} ${lastDate.getFullYear()}`;

    expect(container.textContent).toContain(thisMonth);
    await click(findButton('Bulan Lalu'));
    expect(container.textContent).toContain(lastMonth);
    // omset bulan lalu = Rp 300.000 dan proyeksi diganti "Total Bulan" (angka final)
    expect(container.textContent).toContain('Rp 300.000');
    expect(container.textContent).toContain('Total Bulan');

    await click(findButton('Bulan Ini'));
    expect(container.textContent).toContain('Proyeksi Kas');
  });

  it('changes the revenue chart range and metric', async () => {
    await renderDashboard();
    expect(container.textContent).toContain('Omset 7 Hari Terakhir');

    await click(findButton('14H'));
    expect(container.textContent).toContain('Omset 14 Hari Terakhir');

    await click(findButton('Bln'));
    expect(container.textContent).toContain('Omset Bulan Ini');

    await click(findButton('Trx'));
    expect(container.textContent).toContain('Omset Bulan Ini');
    expect(container.querySelector('[role="group"][aria-label="Metrik"]')).toBeTruthy();
  });

  it('shows the paid/unpaid donut split for active customers', async () => {
    await renderDashboard();
    // Ani sudah bayar bulan ini, Citra belum => 1/2 = 50%
    const donut = container.querySelector('svg[aria-label="50% pelanggan sudah bayar"]');
    expect(donut).toBeTruthy();
  });
});
