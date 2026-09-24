import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Pelanggan from '../Pelanggan';
import History from '../History';
import Settings from '../Settings';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: [] }),
      order: () => ({
        limit: () => Promise.resolve({ data: [] }),
      }),
    }),
  },
}));

describe('Page and Tab Persistence across Refresh & Reopening', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const sampleCustomers = [
    {
      id: 'cust-1',
      name: 'Pelanggan Aktif Satu',
      package: 'Home 10M',
      price: 150000,
      status: 'aktif',
      pppoe_id: 'user_aktif1',
    },
    {
      id: 'cust-2',
      name: 'Pelanggan Isolir Dua',
      package: 'Home 20M',
      price: 250000,
      status: 'isolir',
      pppoe_id: 'user_isolir2',
    },
  ];

  it('Pelanggan page initializes directly on tab specified in URL query params', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/customers?tab=isolir']}>
          <Pelanggan
            customers={sampleCustomers}
            transactions={[]}
            packages={[{ name: 'Home 10M', price: 150000 }, { name: 'Home 20M', price: 250000 }]}
            companyInfo={{}}
          />
        </MemoryRouter>
      );
    });

    // In isolir tab, only the isolir customer should be visible
    expect(container.textContent).toContain('Pelanggan Isolir Dua');
    expect(container.textContent).not.toContain('Pelanggan Aktif Satu');

    root.unmount();
    container.remove();
  });

  it('Pelanggan page falls back to tab saved in localStorage if URL has no tab param', async () => {
    localStorage.setItem('kasir_pelanggan_tab', 'isolir');

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/customers']}>
          <Pelanggan
            customers={sampleCustomers}
            transactions={[]}
            packages={[{ name: 'Home 10M', price: 150000 }, { name: 'Home 20M', price: 250000 }]}
            companyInfo={{}}
          />
        </MemoryRouter>
      );
    });

    // Should open on isolir tab from localStorage
    expect(container.textContent).toContain('Pelanggan Isolir Dua');
    expect(container.textContent).not.toContain('Pelanggan Aktif Satu');

    root.unmount();
    container.remove();
  });

  it('Pelanggan automatically re-opens customer detail modal when ?detail=ID is present in URL', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/customers?detail=cust-2']}>
          <Pelanggan
            customers={sampleCustomers}
            transactions={[]}
            packages={[{ name: 'Home 20M', price: 250000 }]}
            companyInfo={{}}
          />
        </MemoryRouter>
      );
    });

    // Modal with customer details should be open
    expect(container.textContent).toContain('Pelanggan Isolir Dua');
    expect(container.textContent).toContain('Layanan & Teknis');

    root.unmount();
    container.remove();
  });

  it('History page initializes on status tab specified in URL query params', async () => {
    const sampleTrx = [
      {
        id: 'trx-1',
        date: new Date().toISOString(),
        customerName: 'Budi Santoso',
        price: 150000,
        amountPaid: 150000,
        status: 'LUNAS',
        type: 'retail',
      },
      {
        id: 'trx-2',
        date: new Date().toISOString(),
        customerName: 'Siti Kasbon',
        price: 200000,
        amountPaid: 50000,
        status: 'KASBON',
        type: 'retail',
      },
    ];

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/history?tab=kasbon']}>
          <History
            transactions={sampleTrx}
            role="superadmin"
            session={{ access_token: 'fake-token' }}
          />
        </MemoryRouter>
      );
    });

    // Should show Kasbon customer and not Lunas customer
    expect(container.textContent).toContain('Siti Kasbon');
    expect(container.textContent).not.toContain('Budi Santoso');

    root.unmount();
    container.remove();
  });

  it('Settings page initializes on tab specified in URL query params or localStorage', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/settings?tab=ebilling']}>
          <Settings
            packages={[]}
            companyInfo={{}}
            session={{ user: { id: 'u1' }, profile: { role: 'superadmin' } }}
          />
        </MemoryRouter>
      );
    });

    // Should render ebilling tab content
    expect(container.textContent).toContain('Integrasi E-Billing Monitoring System');

    root.unmount();
    container.remove();
  });

  it('Settings page initializes on watbiz tab and renders WhatsApp gateway log UI', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/settings?tab=watbiz']}>
          <Settings
            packages={[]}
            companyInfo={{ watbizToken: 'test-token', watbizEnabled: true }}
            session={{ user: { id: 'u1' }, profile: { role: 'superadmin' } }}
          />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Integrasi WhatsApp (Watbiz)');
    expect(container.textContent).toContain('Log & Riwayat WhatsApp Gateway');

    root.unmount();
    container.remove();
  });
});
