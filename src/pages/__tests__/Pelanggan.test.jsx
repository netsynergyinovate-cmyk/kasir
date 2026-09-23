import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Pelanggan from '../Pelanggan';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

describe('Pelanggan page UI/UX upgrade', () => {
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
      nickname: 'Dahlan',
      address: 'Jl. Merdeka No. 10',
      package: 'NET HOME 10 Mbps',
      price: 200000,
      due_date: '10',
      status: 'aktif',
      pppoe_id: 'ahmad@net',
      phone: '081234567890',
      ip_address: '10.20.1.5',
      mac_address: 'AA:BB:CC:DD:EE:01',
      serial_number: 'ZTEG123456',
      source: 'E-Billing',
      lat: -0.924,
      lng: 100.362,
    },
    {
      id: 'cust-2',
      name: 'Budi Santoso',
      nickname: 'Budi',
      address: 'Jl. Sudirman No. 25',
      package: 'NET HOME 20 Mbps',
      price: 250000,
      due_date: '15',
      status: 'aktif',
      pppoe_id: 'budi@net',
      phone: '081298765432',
      ip_address: '10.20.1.6',
      source: 'Manual',
      lat: null,
      lng: null,
    },
    {
      id: 'cust-3',
      name: 'Citra Kirana',
      nickname: 'Citra',
      address: 'Jl. Thamrin No. 8',
      package: 'NET HOME 10 Mbps',
      price: 200000,
      due_date: '20',
      status: 'isolir',
      pppoe_id: 'citra@net',
      phone: '081311223344',
      source: 'E-Billing',
    }
  ];

  const now = new Date();
  const mockTransactions = [
    {
      id: 'trx-101',
      date: now.toISOString(),
      customerName: 'Ahmad Dahlan',
      pppoeId: 'ahmad@net',
      price: 200000,
      amountPaid: 200000,
      packageName: 'NET HOME 10 Mbps',
      status: 'LUNAS',
      type: 'retail',
      invoiceNumber: 'RN-2026-001',
      cashierName: 'Admin Rian'
    }
  ];

  it('renders interactive KPI summary cards and customer badges', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pelanggan
            customers={mockCustomers}
            transactions={mockTransactions}
            packages={[{ name: 'NET HOME 10 Mbps', price: 200000 }]}
            role="superadmin"
          />
        </MemoryRouter>
      );
    });

    const html = container.innerHTML;
    // Header & KPI metrics
    expect(html).toContain('Data Pelanggan');
    expect(html).toContain('Total Pelanggan');
    expect(html).toContain('Lunas Bulan Ini');
    expect(html).toContain('Belum Bayar');
    expect(html).toContain('E-Billing / Runsnet');

    // Customer cards
    expect(html).toContain('Ahmad Dahlan');
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('Citra Kirana');

    // PPPoE and status badges
    expect(html).toContain('ahmad@net');
    expect(html).toContain('Lunas Bulan Ini');
    expect(html).toContain('Belum Bayar');
  });

  it('filters customer list when clicking KPI card and searching', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pelanggan
            customers={mockCustomers}
            transactions={mockTransactions}
            packages={[{ name: 'NET HOME 10 Mbps', price: 200000 }]}
          />
        </MemoryRouter>
      );
    });

    // Search for Budi
    const searchInput = container.querySelector('input[placeholder*="Cari Nama"]');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(searchInput, 'Budi');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.innerHTML).toContain('Budi Santoso');
    expect(container.innerHTML).not.toContain('Ahmad Dahlan');
  });

  it('toggles between Grid and List view mode', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pelanggan
            customers={mockCustomers}
            transactions={mockTransactions}
          />
        </MemoryRouter>
      );
    });

    // Find view toggle buttons
    const listBtn = container.querySelector('button[title*="Tabel"]');
    expect(listBtn).toBeTruthy();

    await act(async () => {
      listBtn.click();
    });

    // Table elements should now be visible
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.innerHTML).toContain('Pelanggan');
  });

  it('opens 360-degree Customer Profile modal with tabs when clicking info button', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pelanggan
            customers={mockCustomers}
            transactions={mockTransactions}
            role="superadmin"
          />
        </MemoryRouter>
      );
    });

    // Click on detail button for Ahmad Dahlan
    const detailBtn = container.querySelector('button[title*="Detail"]');
    expect(detailBtn).toBeTruthy();

    await act(async () => {
      detailBtn.click();
    });

    // Modal should be open
    expect(container.innerHTML).toContain('Layanan &amp; Teknis');
    expect(container.innerHTML).toContain('Riwayat Tagihan');
    expect(container.innerHTML).toContain('Lokasi &amp; Peta');
    expect(container.innerHTML).toContain('ZTEG123456');

    // Switch to history tab
    const historyTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Riwayat Tagihan'));
    expect(historyTab).toBeTruthy();

    await act(async () => {
      historyTab.click();
    });

    // Should display Ahmad Dahlan's transaction
    expect(container.innerHTML).toContain('RN-2026-001');
    expect(container.innerHTML).toContain('Admin Rian');
  });

  it('opens WhatsApp template modal with reminder and confirmation templates', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pelanggan
            customers={mockCustomers}
            transactions={mockTransactions}
          />
        </MemoryRouter>
      );
    });

    // Click WhatsApp button
    const waBtn = container.querySelector('button[title="Kirim pesan WhatsApp / Tagihan"]');
    expect(waBtn).toBeTruthy();

    await act(async () => {
      waBtn.click();
    });

    // WhatsApp modal should open
    expect(container.innerHTML).toContain('Kirim Pesan WhatsApp');
    expect(container.innerHTML).toContain('Pengingat Tagihan');
    expect(container.innerHTML).toContain('Konfirmasi Lunas');
    expect(container.innerHTML).toContain('Kirim ke WhatsApp');
  });

  it('opens customer detail modal when clicking directly on a card or a table row', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pelanggan
            customers={mockCustomers}
            transactions={mockTransactions}
          />
        </MemoryRouter>
      );
    });

    // In Grid view, find the card with Budi Santoso and click it
    const budiCard = container.querySelector('[title*="Budi Santoso"]');
    expect(budiCard).toBeTruthy();

    await act(async () => {
      budiCard.click();
    });

    // Detail modal should open for Budi Santoso
    expect(container.innerHTML).toContain('Layanan &amp; Teknis');
    expect(container.innerHTML).toContain('budi@net');

    // Close the modal
    const closeBtn = container.querySelector('button[title="Tutup Modal"]');
    if (closeBtn) {
      await act(async () => {
        closeBtn.click();
      });
    }

    // Switch to list view
    const listBtn = container.querySelector('button[title*="Tabel"]');
    await act(async () => {
      listBtn.click();
    });

    // Find the row for Ahmad Dahlan and click it
    const ahmadRow = container.querySelector('tbody tr');
    expect(ahmadRow).toBeTruthy();

    await act(async () => {
      ahmadRow.click();
    });

    // Detail modal should open again
    expect(container.innerHTML).toContain('Layanan &amp; Teknis');
  });
});
