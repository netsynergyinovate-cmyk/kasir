import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (payload) => {
        updateMock(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({
        eq: (column, value) => {
          deleteMock(column, value);
          return Promise.resolve({ error: null });
        },
      }),
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
const baseAdmin = { id: 'adm-budi', full_name: 'Budi', role: 'admin', allowed_paths: { paths: ['/pos'], permissions: [], commissions: [] } };
const thisPeriod = monthKey(new Date(now.getFullYear(), now.getMonth(), 1));
const lastPeriod = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

describe('AdminCommissionModal', () => {
  let container;
  let root;

  beforeEach(() => {
    updateMock.mockClear();
    deleteMock.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
  });

  const renderModal = async (admin = baseAdmin) => {
    await act(async () => {
      root.render(
        <AdminCommissionModal admin={admin} transactions={transactions} companyInfo={{ adminFee: 10000 }} session={{ profile: { full_name: 'CS NET.SI' } }} onClose={() => {}} onSaved={() => {}} />
      );
    });
  };

  const setValue = async (el, value, proto = HTMLInputElement.prototype, event = 'input') => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event(event, { bubbles: true }));
    });
  };
  const click = async (el) => { await act(async () => { el.click(); }); await act(async () => { await Promise.resolve(); }); };

  const payoutInput = () => container.querySelector('input[aria-label="Nominal komisi yang dikirim"]');
  const findButton = (text) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes(text));
  const selectPeriod = (value) => setValue(container.querySelector('#commission-period'), value, HTMLSelectElement.prototype, 'change');

  describe('pencairan per bulan', () => {
    it('defaults to this month: earned = this month only, and the amount field is prefilled with the unpaid balance', async () => {
      await renderModal();
      expect(container.querySelector('#commission-period').value).toBe(thisPeriod);
      expect(container.textContent).toContain('Rp 20.000'); // 2 transaksi × Rp 10.000
      expect(payoutInput().value).toBe('20.000');
    });

    it('switching the month recalculates the earned amount and the suggested payout', async () => {
      await renderModal();
      await selectPeriod(lastPeriod);

      expect(container.textContent).toContain('1 transaksi');
      expect(payoutInput().value).toBe('10.000');
    });

    it('moves between months with the previous / next buttons and cannot go past the current month', async () => {
      await renderModal();
      expect(container.querySelector('button[aria-label="Bulan berikutnya"]').disabled).toBe(true);

      await click(container.querySelector('button[aria-label="Bulan sebelumnya"]'));
      expect(container.querySelector('#commission-period').value).toBe(lastPeriod);
      expect(container.querySelector('button[aria-label="Bulan berikutnya"]').disabled).toBe(false);

      await click(container.querySelector('button[aria-label="Bulan berikutnya"]'));
      expect(container.querySelector('#commission-period').value).toBe(thisPeriod);
    });

    it('records the payout for the selected month, not just the day it was sent', async () => {
      await renderModal();
      await selectPeriod(lastPeriod);
      await click(findButton('Kirim & Catat Komisi'));

      const saved = updateMock.mock.calls[0][0].allowed_paths.commissions[0];
      expect(saved.period).toBe(lastPeriod);
      expect(saved.amount).toBe(10000);
      expect(saved.notes).toContain('Pencairan komisi');
    });
  });

  describe('nominal berformat titik', () => {
    it('shows thousand separators while typing and sends the plain number', async () => {
      await renderModal();
      await setValue(payoutInput(), '150000');
      expect(payoutInput().value).toBe('150.000');
      expect(findButton('Kirim & Catat Komisi').textContent).toContain('Rp 150.000');

      await click(findButton('Kirim & Catat Komisi'));
      expect(updateMock.mock.calls[0][0].allowed_paths.commissions[0].amount).toBe(150000);
    });

    it('warns when the amount exceeds what is still unpaid, and disables sending an empty amount', async () => {
      await renderModal();
      await setValue(payoutInput(), '999999');
      expect(container.textContent).toContain('Nominal melebihi sisa komisi');

      await setValue(payoutInput(), '');
      expect(findButton('Kirim & Catat Komisi').disabled).toBe(true);
    });

    it('offers "Kirim semua sisa" to refill the amount with the unpaid balance', async () => {
      await renderModal();
      await setValue(payoutInput(), '5000');
      await click(findButton('Kirim semua sisa'));
      expect(payoutInput().value).toBe('20.000');
    });
  });

  describe('tambahan komisi', () => {
    const addBonus = async (amount, note) => {
      await setValue(container.querySelector('input[aria-label="Nominal tambahan komisi"]'), amount);
      if (note) await setValue(container.querySelector('input[aria-label="Keterangan tambahan komisi"]'), note);
      await click(Array.from(container.querySelectorAll('button[type="submit"]')).find((b) => b.textContent.includes('Tambahkan')));
    };

    it('adds a bonus for the chosen month, raising the earned total, and saves it with its period', async () => {
      await renderModal();
      await addBonus('50000', 'Target tercapai');

      const saved = updateMock.mock.calls[0][0].allowed_paths.bonuses[0];
      expect(saved).toMatchObject({ amount: 50000, period: thisPeriod, notes: 'Target tercapai' });

      // hak komisi = 2 trx x 10rb + tambahan 50rb = 70rb, dan tampil di daftar tambahan
      expect(container.textContent).toContain('Rp 70.000');
      expect(container.textContent).toContain('Target tercapai');
      expect(container.textContent).toContain('+Rp 50.000');
    });

    it('quick amounts add up in the bonus field', async () => {
      await renderModal();
      const bonusInput = () => container.querySelector('input[aria-label="Nominal tambahan komisi"]');
      await click(findButton('+25.000'));
      await click(findButton('+50.000'));
      expect(bonusInput().value).toBe('75.000');
    });

    it('keeps earlier records when saving a payout after a bonus in the same session', async () => {
      await renderModal();
      await addBonus('50000');

      await setValue(payoutInput(), '20000');
      await click(findButton('Kirim & Catat Komisi'));

      const lastSaved = updateMock.mock.calls.at(-1)[0].allowed_paths;
      expect(lastSaved.bonuses).toHaveLength(1); // tambahan tidak hilang tertimpa pencairan
      expect(lastSaved.commissions).toHaveLength(1);
    });
  });

  describe('hapus pencairan', () => {
    const adminWithPayouts = {
      ...baseAdmin,
      allowed_paths: {
        paths: ['/pos'],
        permissions: [],
        commissions: [
          { id: 'c1', amount: 8000, status: 'TERKIRIM', period: thisPeriod, notes: 'Pencairan awal', sent_at: at(0, 2), payment_method: 'Tunai / Cash' },
          { id: 'c2', amount: 5000, status: 'TERKIRIM', period: thisPeriod, notes: 'Pencairan kedua', sent_at: at(0, 3), payment_method: 'Tunai / Cash' },
        ],
      },
    };

    it('removes the chosen payout only, after confirmation, and the unpaid balance goes back up', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await renderModal(adminWithPayouts);
      // 20.000 - 8.000 - 5.000 = 7.000 belum cair
      expect(container.textContent).toContain('Rp 7.000');

      const deleteButtons = container.querySelectorAll('button[aria-label="Hapus pencairan"]');
      expect(deleteButtons).toHaveLength(2);
      await click(deleteButtons[0]);

      const saved = updateMock.mock.calls[0][0].allowed_paths.commissions;
      expect(saved.map((c) => c.id)).toEqual(['c2']);
      expect(deleteMock).toHaveBeenCalledWith('id', 'c1'); // baris tabel relasional ikut dihapus
      expect(container.textContent).toContain('Rp 15.000'); // 20.000 - 5.000
      expect(container.querySelectorAll('button[aria-label="Hapus pencairan"]')).toHaveLength(1);
    });

    it('does nothing when the confirmation is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      await renderModal(adminWithPayouts);
      await click(container.querySelector('button[aria-label="Hapus pencairan"]'));

      expect(updateMock).not.toHaveBeenCalled();
      expect(container.querySelectorAll('button[aria-label="Hapus pencairan"]')).toHaveLength(2);
    });
  });

  describe('salin rekap', () => {
    it('copies a WhatsApp-ready recap of the selected month', async () => {
      const writeText = vi.fn().mockResolvedValue();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

      await renderModal();
      await click(findButton('Salin rekap'));

      const text = writeText.mock.calls[0][0];
      expect(text).toContain('*Rekap Komisi Budi');
      expect(text).toContain('Transaksi otomatis: 2 × Rp 10.000 = Rp 20.000');
      expect(text).toContain('*Total hak komisi: Rp 20.000*');
      expect(text).toContain('Belum cair: Rp 20.000');
      expect(container.textContent).toContain('Rekap komisi');
    });
  });
});
