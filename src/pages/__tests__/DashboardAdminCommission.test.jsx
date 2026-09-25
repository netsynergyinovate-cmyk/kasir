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

const now = new Date();
const at = (monthOffset, day) => new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 10, 0, 0).toISOString();
const own = (id, date) => ({ id, date, price: 165000, status: 'LUNAS', type: 'retail', customerName: `Pelanggan ${id}`, cashier_id: 'adm-budi', cashier_name: 'Budi Admin', payment_method: 'CASH' });

const transactions = [
  own('1', at(0, 1)),
  own('2', at(0, 2)),
  own('3', at(-1, 5)),
  { ...own('4', at(0, 3)), cashier_id: 'adm-lain', cashier_name: 'Admin Lain' },
];

const session = {
  user: { id: 'adm-budi' },
  profile: {
    role: 'admin',
    full_name: 'Budi Admin',
    allowed_paths: { commissions: [{ id: 'c1', amount: 10000, status: 'TERKIRIM', notes: 'Pencairan Agustus', sent_at: at(-1, 28), sent_by_name: 'CS NET.SI' }] },
  },
};

describe('Dashboard admin: keterangan komisi', () => {
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

  it('shows accumulated commission with the calculation, paid-out and unpaid amounts', async () => {
    await renderDashboard();
    const text = container.textContent;
    expect(text).toContain('Hak komisi (akumulasi)');
    expect(text).toContain('Rp 30.000'); // 3 transaksi milik Budi × Rp 10.000
    expect(text).toContain('3 transaksi × Rp 10.000');
    expect(text).toContain('Sudah cair (Superadmin)');
    expect(text).toContain('Belum cair');
    expect(text).toContain('Rp 20.000'); // 30.000 - 10.000 sudah dicairkan
  });

  it('opens the explanation with rules and a per-month breakdown that adds up to the total', async () => {
    await renderDashboard();
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Cara hitung'));
    await act(async () => { button.click(); });

    const text = container.textContent;
    expect(text).toContain('tarif Rp 10.000 per transaksi');
    expect(text).toContain('ditetapkan Superadmin');
    expect(text).toContain('Rincian per Bulan');
    expect(text).toContain('2 trx × Rp 10.000 = Rp 20.000'); // bulan ini
    expect(text).toContain('1 trx × Rp 10.000 = Rp 10.000'); // bulan lalu
    expect(text).toContain('Total hak komisi');
    expect(text).toContain('3 trx = Rp 30.000');
    expect(text).toContain('Pencairan Agustus');
  });
});
