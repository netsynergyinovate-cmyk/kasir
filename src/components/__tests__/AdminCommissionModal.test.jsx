import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const updateMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (payload) => {
        updateMock(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

import AdminCommissionModal from '../AdminCommissionModal';
import { monthKey } from '../../utils/commissions';

const now = new Date();
const at = (monthOffset, day) => new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 10, 0, 0).toISOString();
const own = (id, date) => ({ id, date, price: 165000, status: 'LUNAS', type: 'retail', cashier_id: 'adm-budi', cashier_name: 'Budi', payment_method: 'CASH' });

// Bulan ini 2 transaksi, bulan lalu 1 transaksi
const transactions = [own('1', at(0, 1)), own('2', at(0, 2)), own('3', at(-1, 5))];
const admin = { id: 'adm-budi', full_name: 'Budi', role: 'admin', allowed_paths: { paths: ['/pos'], permissions: [], commissions: [] } };
const thisPeriod = monthKey(new Date(now.getFullYear(), now.getMonth(), 1));
const lastPeriod = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

describe('AdminCommissionModal: pencairan per bulan', () => {
  let container;
  let root;

  beforeEach(() => {
    updateMock.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderModal = async () => {
    await act(async () => {
      root.render(
        <AdminCommissionModal admin={admin} transactions={transactions} companyInfo={{ adminFee: 10000 }} session={{ profile: { full_name: 'CS NET.SI' } }} onClose={() => {}} onSaved={() => {}} />
      );
    });
  };

  const setValue = async (el, value, proto, event) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event(event, { bubbles: true }));
    });
  };

  it('defaults to this month: earned = this month only, and the amount field is prefilled with the unpaid balance', async () => {
    await renderModal();
    expect(container.querySelector('#commission-period').value).toBe(thisPeriod);
    expect(container.textContent).toContain('Rp 20.000'); // 2 transaksi × Rp 10.000
    expect(container.querySelector('input[type="number"][required]').value).toBe('20000');
  });

  it('switching the month recalculates the earned amount and the suggested payout', async () => {
    await renderModal();
    await setValue(container.querySelector('#commission-period'), lastPeriod, HTMLSelectElement.prototype, 'change');

    expect(container.textContent).toContain('1 Trx');
    expect(container.querySelector('input[type="number"][required]').value).toBe('10000');
  });

  it('records the payout for the selected month, not just the day it was sent', async () => {
    await renderModal();
    await setValue(container.querySelector('#commission-period'), lastPeriod, HTMLSelectElement.prototype, 'change');

    await act(async () => { Array.from(container.querySelectorAll('button[type="submit"]')).find((b) => b.textContent.includes('Kirim & Catat Komisi')).click(); });
    await act(async () => { await Promise.resolve(); });

    const saved = updateMock.mock.calls[0][0].allowed_paths.commissions[0];
    expect(saved.period).toBe(lastPeriod);
    expect(saved.amount).toBe(10000);
    expect(saved.notes).toContain('Pencairan komisi');
  });

  it('lets the Superadmin add a bonus for the chosen month, which raises the earned total and is saved with its period', async () => {
    await renderModal();
    await setValue(container.querySelector('input[aria-label="Nominal tambahan komisi"]'), '50000', HTMLInputElement.prototype, 'input');
    await setValue(container.querySelector('input[aria-label="Keterangan tambahan komisi"]'), 'Target tercapai', HTMLInputElement.prototype, 'input');

    const addButton = Array.from(container.querySelectorAll('button[type="submit"]')).find((b) => b.textContent.includes('Tambahkan'));
    await act(async () => { addButton.click(); });
    await act(async () => { await Promise.resolve(); });

    const saved = updateMock.mock.calls[0][0].allowed_paths.bonuses[0];
    expect(saved).toMatchObject({ amount: 50000, period: thisPeriod, notes: 'Target tercapai' });

    // hak komisi = 2 trx x 10rb + tambahan 50rb = 70rb, dan tampil di daftar tambahan
    expect(container.textContent).toContain('Rp 70.000');
    expect(container.textContent).toContain('Target tercapai');
    expect(container.textContent).toContain('+Rp 50.000');
  });

  it('keeps earlier records when saving a payout after a bonus in the same session', async () => {
    await renderModal();
    await setValue(container.querySelector('input[aria-label="Nominal tambahan komisi"]'), '50000', HTMLInputElement.prototype, 'input');
    const addButton = Array.from(container.querySelectorAll('button[type="submit"]')).find((b) => b.textContent.includes('Tambahkan'));
    await act(async () => { addButton.click(); });
    await act(async () => { await Promise.resolve(); });

    await setValue(container.querySelector('input[type="number"][required]'), '20000', HTMLInputElement.prototype, 'input');
    await act(async () => { Array.from(container.querySelectorAll('button[type="submit"]')).find((b) => b.textContent.includes('Kirim & Catat Komisi')).click(); });
    await act(async () => { await Promise.resolve(); });

    const lastSaved = updateMock.mock.calls.at(-1)[0].allowed_paths;
    expect(lastSaved.bonuses).toHaveLength(1); // tambahan tidak hilang tertimpa pencairan
    expect(lastSaved.commissions).toHaveLength(1);
  });
});
