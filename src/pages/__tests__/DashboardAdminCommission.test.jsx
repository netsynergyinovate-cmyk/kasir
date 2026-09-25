import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => {
  const result = Promise.resolve({ data: [], error: null });
  const chain = { order: () => chain, limit: () => result, then: (...args) => result.then(...args) };
  return { supabase: { from: () => ({ select: () => chain }) } };
});

import Dashboard from '../Dashboard';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const now = new Date();
const at = (monthOffset, day) => new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 10, 0, 0).toISOString();
const monthName = (offset) => {
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};
const own = (id, date) => ({ id, date, price: 165000, status: 'LUNAS', type: 'retail', customerName: `Pelanggan ${id}`, cashier_id: 'adm-budi', cashier_name: 'Budi Admin', payment_method: 'CASH' });

// Bulan ini: 2 transaksi Budi (+1 milik admin lain). Bulan lalu: 1 transaksi Budi.
const transactions = [
  own('1', at(0, 1)),
  own('2', at(0, 2)),
  own('3', at(-1, 5)),
  { ...own('4', at(0, 3)), cashier_id: 'adm-lain', cashier_name: 'Admin Lain' },
];

// Superadmin mencairkan Rp 4.000 untuk komisi bulan lalu (dikirim bulan ini), sisanya Rp 6.000 belum cair.
const session = {
  user: { id: 'adm-budi' },
  profile: {
    role: 'admin',
    full_name: 'Budi Admin',
    allowed_paths: {
      commissions: [
        { id: 'c1', amount: 4000, status: 'TERKIRIM', period: `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(((now.getMonth() + 11) % 12) + 1).padStart(2, '0')}`, notes: 'Pencairan bulan lalu', sent_at: at(0, 2), sent_by_name: 'CS NET.SI' },
      ],
    },
  },
};

describe('Dashboard admin: komisi per bulan dan keterangannya', () => {
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
          <Dashboard transactions={transactions} customers={[]} packages={[]} companyInfo={{ adminFee: 10000 }} session={session} />
        </MemoryRouter>
      );
    });
  };

  it('shows this month\'s commission only, with the calculation, and points out unpaid amounts from other months', async () => {
    await renderDashboard();
    const text = container.textContent;
    expect(text).toContain(`Hak komisi ${monthName(0)}`);
    expect(text).toContain('Rp 20.000'); // 2 transaksi bulan ini × Rp 10.000, bukan 3 (bulan lalu tidak ikut)
    expect(text).toContain('2 transaksi × Rp 10.000');
    expect(text).toContain('Sudah cair bulan ini (Superadmin): Rp 0'); // pencairan itu untuk bulan lalu
    expect(text).toContain('Belum cair bulan ini: Rp 20.000');
    expect(text).toContain('Sisa bulan lain belum cair');
    expect(text).toContain('Rp 6.000'); // 10.000 - 4.000 dari bulan lalu
  });

  it('opens the explanation with rules and a per-month table that shows paid and unpaid per month', async () => {
    await renderDashboard();
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Cara hitung'));
    await act(async () => { button.click(); });

    const text = container.textContent;
    expect(text).toContain('tarif Rp 10.000 per transaksi');
    expect(text).toContain('ditetapkan Superadmin');
    expect(text).toContain('Komisi dihitung per bulan');
    expect(text).toContain('Rincian per Bulan');
    expect(text).toContain(monthName(0));
    expect(text).toContain(monthName(-1));
    expect(text).toContain('2 trx × Rp 10.000 = Rp 20.000'); // bulan ini
    expect(text).toContain('1 trx × Rp 10.000 = Rp 10.000'); // bulan lalu
    expect(text).toContain('Sudah cair: Rp 4.000'); // untuk bulan lalu
    expect(text).toContain('Belum cair: Rp 6.000');
    expect(text).toContain('Total semua bulan');
    expect(text).toContain('3 trx = Rp 30.000');
    expect(text).toContain(`Untuk komisi ${monthName(-1)}`);
  });
});
