import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import History from '../History';

// Mock supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: [] }),
    }),
  },
}));

describe('History page UI and detailed Runsnet status', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  const sampleTransactions = [
    {
      id: 'trx-1',
      date: new Date().toISOString(),
      customerName: 'Budi Santoso',
      price: 150000,
      amountPaid: 150000,
      packageName: '10 Mbps Home',
      pppoeId: 'budi_net',
      paymentMethod: 'Cash',
      cashierName: 'Admin Rian',
      status: 'LUNAS',
      type: 'retail',
      invoiceNumber: 'INV-2024-001',
    },
    {
      id: 'trx-2',
      date: new Date().toISOString(),
      customerName: 'Siti Aminah',
      price: 200000,
      amountPaid: 50000,
      packageName: '20 Mbps Pro',
      pppoeId: 'siti_wifi',
      paymentMethod: 'Transfer',
      cashierName: 'Admin Rian',
      status: 'KASBON',
      type: 'retail',
      invoiceNumber: 'INV-2024-002',
    },
    {
      id: 'trx-3',
      date: new Date().toISOString(),
      instansiName: 'SMK Negeri 1',
      price: 1500000,
      amountPaid: 1500000,
      serviceName: 'Dedicated Fiber 50 Mbps',
      paymentMethod: 'Transfer Bank',
      cashierName: 'Admin Utama',
      status: 'LUNAS',
      type: 'instansi',
      invoiceNumber: 'INV-INST-001',
    },
  ];

  it('renders all transaction details: PPPoE, package name, cashier, payment method, and amount', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <History
            transactions={sampleTransactions}
            role="superadmin"
            session={{ access_token: 'fake-token' }}
            setReceiptToView={() => {}}
            setInstansiReceiptToView={() => {}}
            onDeleteTransaction={() => {}}
          />
        </MemoryRouter>
      );
    });

    const text = container.textContent;
    // Customer names
    expect(text).toContain('Budi Santoso');
    expect(text).toContain('Siti Aminah');
    expect(text).toContain('SMK Negeri 1');

    // Packages and services
    expect(text).toContain('10 Mbps Home');
    expect(text).toContain('20 Mbps Pro');
    expect(text).toContain('Dedicated Fiber 50 Mbps');

    // PPPoE accounts
    expect(text).toContain('PPPoE: budi_net');
    expect(text).toContain('PPPoE: siti_wifi');

    // Cashier names
    expect(text).toContain('Admin Rian');
    expect(text).toContain('Admin Utama');

    // Payment methods
    expect(text).toContain('Cash');
    expect(text).toContain('Transfer');

    // Statuses
    expect(text).toContain('LUNAS');
    expect(text).toContain('KASBON');
    expect(text).toContain('INSTANSI');

    root.unmount();
    container.remove();
  });

  it('filters by status tabs (Lunas, Kasbon, Instansi)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <History
            transactions={sampleTransactions}
            role="superadmin"
            session={{ access_token: 'fake-token' }}
            setReceiptToView={() => {}}
            setInstansiReceiptToView={() => {}}
            onDeleteTransaction={() => {}}
          />
        </MemoryRouter>
      );
    });

    // Find tab buttons
    const buttons = Array.from(container.querySelectorAll('button'));
    const lunasTab = buttons.find((b) => b.textContent.includes('Lunas ('));
    const kasbonTab = buttons.find((b) => b.textContent.includes('Kasbon ('));
    const instansiTab = buttons.find((b) => b.textContent.includes('Instansi ('));

    expect(lunasTab).toBeDefined();
    expect(kasbonTab).toBeDefined();
    expect(instansiTab).toBeDefined();

    // Click Kasbon Tab
    await act(async () => {
      kasbonTab.click();
    });

    expect(container.textContent).toContain('Siti Aminah');
    expect(container.textContent).not.toContain('Budi Santoso');
    expect(container.textContent).not.toContain('SMK Negeri 1');

    // Click Instansi Tab
    await act(async () => {
      instansiTab.click();
    });

    expect(container.textContent).toContain('SMK Negeri 1');
    expect(container.textContent).not.toContain('Siti Aminah');

    root.unmount();
    container.remove();
  });

  it('displays Runsnet invoice number or Tautkan Runsnet button', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const testTransactions = [
      {
        id: 'trx-1',
        date: new Date().toISOString(),
        customerName: 'Budi Santoso',
        price: 150000,
        amountPaid: 150000,
        pppoeId: 'budi_net',
        status: 'LUNAS',
        type: 'retail',
        invoiceNumber: 'RN-2024-888', // Nomor invoice resmi Runsnet
      },
      {
        id: 'trx-2',
        date: new Date().toISOString(),
        customerName: 'Siti Aminah',
        price: 200000,
        amountPaid: 200000,
        pppoeId: 'siti_wifi',
        status: 'LUNAS',
        type: 'retail',
        invoiceNumber: 'INV-1727000111', // Nomor lokal
      },
    ];

    await act(async () => {
      root.render(
        <MemoryRouter>
          <History
            transactions={testTransactions}
            role="superadmin"
            session={{ access_token: 'fake-token' }}
            setReceiptToView={() => {}}
            setInstansiReceiptToView={() => {}}
            onDeleteTransaction={() => {}}
          />
        </MemoryRouter>
      );
    });

    // Check that official Runsnet invoice is displayed with #
    expect(container.textContent).toContain('#RN-2024-888');

    // Check that local invoice has Tautkan Runsnet button
    expect(container.textContent).toContain('Tautkan Runsnet');

    root.unmount();
    container.remove();
  });
});

