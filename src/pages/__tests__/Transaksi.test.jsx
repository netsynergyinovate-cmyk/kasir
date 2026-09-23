import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});

