import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Transaksi from '../Transaksi';

describe('Transaksi POS pre-selection via URL search params', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const mockCustomers = [
    {
      id: 'cust-1',
      name: 'Ahmad Dahlan',
      package: 'NET HOME 10 Mbps',
      price: 200000,
      due_date: '10',
      status: 'aktif',
      pppoe_id: 'ahmad@net',
    },
    {
      id: 'cust-2',
      name: 'Budi Santoso',
      package: 'NET HOME 20 Mbps',
      price: 250000,
      due_date: '15',
      status: 'aktif',
      pppoe_id: 'budi@net',
    },
  ];

  it('automatically selects the customer specified in the ?cust query parameter', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/pos?cust=cust-2']}>
          <Transaksi
            customers={mockCustomers}
            transactions={[]}
            packages={[{ name: 'NET HOME 20 Mbps', price: 250000 }]}
          />
        </MemoryRouter>
      );
    });

    const html = container.innerHTML;
    // Budi Santoso should be selected and his package details shown
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('NET HOME 20 Mbps');
    expect(html).toContain('Rp 250.000');
  });

  const renderPos = async (entry = '/pos?cust=cust-2') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <Transaksi
            customers={mockCustomers}
            transactions={[]}
            packages={[{ name: 'NET HOME 10 Mbps', price: 200000 }, { name: 'NET HOME 20 Mbps', price: 250000 }]}
          />
        </MemoryRouter>
      );
    });
  };

  const typeAmount = async (value) => {
    const input = container.querySelector('input[aria-label="Uang diterima"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('shows change (Kembalian) or shortfall (Kurang) computed from the amount paid', async () => {
    await renderPos();

    await typeAmount('300000');
    expect(container.querySelector('input[aria-label="Uang diterima"]').value).toBe('300.000');
    expect(container.textContent).toContain('Kembalian');
    expect(container.textContent).toContain('Rp 50.000');

    await typeAmount('200000');
    expect(container.textContent).toContain('Kurang');
    expect(container.textContent).toContain('Rp 50.000');
  });

  it('lets the cashier override the package and its price', async () => {
    await renderPos();
    const select = container.querySelector('select');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'NET HOME 10 Mbps');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Rp 200.000');
    expect(container.querySelector('input[name="amountPaid"]').value).toBe('200000');
  });

  it('shows no package or change block when no customer is selected', async () => {
    await renderPos('/pos');
    expect(container.textContent).toContain('Pilih Pelanggan Dulu');
    expect(container.textContent).not.toContain('Kembalian');
  });

  const statusButton = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);

  it('automatically switches to KASBON when the amount paid is less than the package price', async () => {
    await renderPos();
    await typeAmount('200000'); // Budi's package is Rp 250.000
    expect(statusButton('KASBON').className).toContain('bg-white');
    expect(statusButton('LUNAS').className).not.toContain('bg-white');
  });

  it('switches back to LUNAS automatically once the amount covers the full price', async () => {
    await renderPos();
    await typeAmount('200000');
    expect(statusButton('KASBON').className).toContain('bg-white');
    await typeAmount('250000');
    expect(statusButton('LUNAS').className).toContain('bg-white');
  });

  it('lets the cashier override the auto status manually', async () => {
    await renderPos();
    await typeAmount('250000'); // full price -> auto LUNAS
    await act(async () => { statusButton('KASBON').click(); });
    expect(statusButton('KASBON').className).toContain('bg-white');
  });

  it('hides only customers paid in the cashier app (not billing) and Terminate; toggle shows paid ones', async () => {
    const customers = [
      { id: 'a', custid: 'C-APP', name: 'Ani Lunas App', package: 'NET HOME 10 Mbps', status: 'aktif' },
      { id: 'b', custid: 'C-BILL', name: 'Beni Lunas Billing', package: 'NET HOME 10 Mbps', status: 'aktif' },
      { id: 'c', custid: 'C-TERM', name: 'Cici Terminate', package: 'NET HOME 10 Mbps', status: 'terminate' },
      { id: 'd', custid: 'C-ISO', name: 'Dodi Isolir', package: 'NET HOME 10 Mbps', status: 'nonaktif' },
      { id: 'e', custid: 'C-NEW', name: 'Eka Belum Bayar', package: 'NET HOME 10 Mbps', status: 'aktif' },
    ];
    const transactions = [{ type: 'retail', status: 'LUNAS', customerName: 'Ani Lunas App', date: new Date().toISOString() }];
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/pos']}>
          <Transaksi customers={customers} transactions={transactions} packages={[]} session={{ access_token: 'tok' }} />
        </MemoryRouter>
      );
    });
    await act(async () => { container.querySelector('input[type="text"]').focus(); });

    const text = container.textContent;
    expect(text).toContain('Eka Belum Bayar');
    expect(text).toContain('Dodi Isolir');
    expect(text).toContain('Beni Lunas Billing');
    expect(text).not.toContain('Ani Lunas App');
    expect(text).not.toContain('Cici Terminate');
    expect(text).toContain('3 belum bayar');
    expect(text).toContain('1 lunas disembunyikan');
    expect(text).toContain('1 terminate');

    const toggle = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('lunas disembunyikan'));
    await act(async () => { toggle.click(); });
    await act(async () => { container.querySelector('input[type="text"]').focus(); });
    expect(container.textContent).toContain('1 lunas ditampilkan');
    expect(container.textContent).toContain('Ani Lunas App');
    expect(container.textContent).toContain('LUNAS');
    expect(container.textContent).not.toContain('Cici Terminate');
  });

  it('finds a paid customer by name when the cashier types, even while paid ones are hidden', async () => {
    const customers = [
      { id: 'a', custid: 'C-APP', name: 'Anita Lunas', package: 'NET HOME 10 Mbps', status: 'aktif' },
      { id: 'e', custid: 'C-NEW', name: 'Eka Belum Bayar', package: 'NET HOME 10 Mbps', status: 'aktif' },
    ];
    const transactions = [{ type: 'retail', status: 'LUNAS', customerName: 'Anita Lunas', date: new Date().toISOString() }];
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/pos']}>
          <Transaksi customers={customers} transactions={transactions} packages={[]} session={{ access_token: 'tok' }} />
        </MemoryRouter>
      );
    });
    const input = container.querySelector('input[type="text"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(input, 'anita');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Anita Lunas');
    expect(container.textContent).not.toContain('Pelanggan tidak ditemukan');
  });
});
