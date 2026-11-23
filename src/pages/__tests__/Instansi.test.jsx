import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Instansi from '../Instansi';

const clients = [{ id: 1, client_code: '1824', institution_name: 'Pemerintah Desa Tunggal Jaya', status: 'active', service_package: 'NSI Network 50 Mbps' }];
const invoices = [{ id: 9, kind: 'invoice', status: 'pending', amount: 500000, invoice_number: 'INV-001', issued_date: '2026-11-01', due_date: '2026-11-10', client: clients[0] }];

vi.mock('../../lib/supabase', () => {
  const result = (table) => ({ data: table === 'instansi_clients' ? clients : table === 'instansi_invoices' ? invoices : null });
  const chain = (table) => {
    const q = { select: () => q, order: () => Promise.resolve(result(table)), eq: () => q, maybeSingle: () => Promise.resolve(result(table)) };
    return q;
  };
  return { supabase: { from: chain } };
});

describe('Instansi page', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const render = async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/instansi']}><Instansi session={{ profile: { role: 'superadmin' } }} /></MemoryRouter>);
    });
  };

  it('shows its own bottom nav with instansi menus and switches tab from it', async () => {
    await render();
    const nav = container.querySelector('nav[aria-label="Menu Instansi"]');
    const labels = [...nav.querySelectorAll('button')].map((b) => b.textContent.trim());
    ['Beranda', 'Klien', 'Invoice1', 'Faktur', 'Massal'].forEach((l) => expect(labels).toContain(l));
    expect(nav.querySelector('[aria-label="Tambah Klien"]')).not.toBeNull();
    expect(container.textContent).toContain('Pemerintah Desa Tunggal Jaya');

    const invoiceTab = [...nav.querySelectorAll('button')].find((b) => b.textContent.startsWith('Invoice'));
    await act(async () => invoiceTab.click());
    expect(invoiceTab.getAttribute('aria-current')).toBe('page');
    expect(nav.querySelector('[aria-label="Terbitkan Invoice"]')).not.toBeNull();
    expect(container.textContent).toContain('INV-001');
  });
});
