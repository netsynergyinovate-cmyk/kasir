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
    expect(container.querySelector('input[type="number"]').value).toBe('20000');
  });

  it('switching the month recalculates the earned amount and the suggested payout', async () => {
    await renderModal();
    await setValue(container.querySelector('#commission-period'), lastPeriod, HTMLSelectElement.prototype, 'change');

    expect(container.textContent).toContain('1 Trx');
    expect(container.querySelector('input[type="number"]').value).toBe('10000');
  });

  it('records the payout for the selected month, not just the day it was sent', async () => {
    await renderModal();
    await setValue(container.querySelector('#commission-period'), lastPeriod, HTMLSelectElement.prototype, 'change');

    await act(async () => { container.querySelector('button[type="submit"]').click(); });
    await act(async () => { await Promise.resolve(); });

    const saved = updateMock.mock.calls[0][0].allowed_paths.commissions[0];
    expect(saved.period).toBe(lastPeriod);
    expect(saved.amount).toBe(10000);
    expect(saved.notes).toContain('Pencairan komisi');
  });
});
