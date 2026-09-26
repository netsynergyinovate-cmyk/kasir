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

  const renderWithTransactions = async (customTransactions) => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DashboardSuperadmin
            session={{ profile: { full_name: 'Super Administrator', role: 'superadmin' } }}
            transactions={customTransactions}
            customers={[]}
            packages={[]}
            companyInfo={{ adminFee: 10000 }}
          />
        </MemoryRouter>
      );
    });
  };

  it('sorts the cashier leaderboard by Omset by default, and by transaction count when switched to Trx', async () => {
    await renderWithTransactions([
      { id: 'a1', date: at(0, 1), price: 500000, status: 'LUNAS', type: 'retail', customerName: 'X1', cashier_name: 'Ani Kasir', payment_method: 'CASH' },
      { id: 'b1', date: at(0, 2), price: 100000, status: 'LUNAS', type: 'retail', customerName: 'X2', cashier_name: 'Budi Kasir', payment_method: 'CASH' },
      { id: 'b2', date: at(0, 3), price: 100000, status: 'LUNAS', type: 'retail', customerName: 'X3', cashier_name: 'Budi Kasir', payment_method: 'CASH' },
      { id: 'b3', date: at(0, 4), price: 100000, status: 'LUNAS', type: 'retail', customerName: 'X4', cashier_name: 'Budi Kasir', payment_method: 'CASH' },
    ]);

    // Omset (bawaan): Ani (Rp 500rb) tampil sebelum Budi (Rp 300rb, tapi 3 trx)
    expect(container.textContent.indexOf('Ani Kasir')).toBeLessThan(container.textContent.indexOf('Budi Kasir'));

    // Ada dua tombol berlabel "Trx" (toggle metrik grafik & toggle urutan leaderboard) — leaderboard
    // muncul belakangan di DOM, jadi ambil yang terakhir.
    const trxButtons = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent.trim() === 'Trx');
    await click(trxButtons[trxButtons.length - 1]);
    // Trx: Budi (3 trx) sekarang tampil duluan walau omsetnya lebih kecil
    expect(container.textContent.indexOf('Budi Kasir')).toBeLessThan(container.textContent.indexOf('Ani Kasir'));
  });

  it('filters the cashier leaderboard by pending commission and by non-commission (CS) channel', async () => {
    await renderWithTransactions([
      { id: 'a1', date: at(0, 1), price: 500000, status: 'LUNAS', type: 'retail', customerName: 'X1', cashier_name: 'Ani Kasir', payment_method: 'CASH' },
      { id: 'c1', date: at(0, 2), price: 50000, status: 'LUNAS', type: 'retail', customerName: 'X2', cashier_name: 'CS Toko', payment_method: 'CASH' },
    ]);

    expect(findButton('Semua (2)')).toBeTruthy();
    expect(findButton('Pending (1)')).toBeTruthy();
    expect(findButton('Non-Komisi (1)')).toBeTruthy();
    expect(container.textContent).toContain('Ani Kasir');
    expect(container.textContent).toContain('CS Toko');

    await click(findButton('Non-Komisi (1)'));
    expect(container.textContent).toContain('CS Toko');
    expect(container.textContent).not.toContain('Ani Kasir');

    await click(findButton('Pending (1)'));
    expect(container.textContent).toContain('Ani Kasir');
    expect(container.textContent).not.toContain('CS Toko');
  });

  it('lists recent transactions, filters them by payment method, and opens a receipt on click', async () => {
    const setReceiptToView = vi.fn();
    const setInstansiReceiptToView = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <DashboardSuperadmin
            session={{ profile: { full_name: 'Super Administrator', role: 'superadmin' } }}
            transactions={[
              { id: 't1', date: at(0, 1), price: 200000, status: 'LUNAS', type: 'retail', customerName: 'Ani', payment_method: 'Cash' },
              { id: 't2', date: at(0, 2), price: 150000, status: 'LUNAS', type: 'retail', customerName: 'Budi', payment_method: 'Transfer Bank' },
            ]}
            customers={[]}
            packages={[]}
            companyInfo={{ adminFee: 10000 }}
            setReceiptToView={setReceiptToView}
            setInstansiReceiptToView={setInstansiReceiptToView}
          />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Aktivitas Transaksi Terbaru');
    expect(container.textContent).toContain('Ani');
    expect(container.textContent).toContain('Budi');

    const aniRow = Array.from(container.querySelectorAll('h6')).find((h) => h.textContent === 'Ani').closest('.cursor-pointer');
    await click(aniRow);
    expect(setReceiptToView).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    expect(setInstansiReceiptToView).not.toHaveBeenCalled();

    await click(findButton('Transfer'));
    expect(container.textContent).toContain('Budi');
    expect(container.textContent).not.toContain('Ani');
  });

  it('exports the recent transaction list to a downloadable CSV file', async () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

    await renderWithTransactions([
      { id: 't1', date: at(0, 1), price: 200000, status: 'LUNAS', type: 'retail', customerName: 'Ani', payment_method: 'Cash' },
    ]);

    await click(findButton('CSV'));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
