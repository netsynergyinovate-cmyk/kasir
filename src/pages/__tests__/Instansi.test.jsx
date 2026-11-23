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
  const navButton = (nav, label) => [...nav.querySelectorAll('button')].find((b) => b.textContent.startsWith(label));

  it('opens on the Instansi home with billing info, not the app home', async () => {
    await render();
    const nav = container.querySelector('nav[aria-label="Menu Instansi"]');
    expect(navButton(nav, 'Beranda').getAttribute('aria-current')).toBe('page');
    expect(container.textContent).toContain('Beranda Instansi');
    expect(container.textContent).toContain('Perlu Ditagih');
    expect(container.textContent).toContain('INV-001');
    expect(nav.querySelector('[aria-label="Terbitkan Invoice"]')).not.toBeNull();
  });

  it('switches feature tabs from its own bottom nav', async () => {
    await render();
    const nav = container.querySelector('nav[aria-label="Menu Instansi"]');
    ['Klien', 'Invoice', 'Faktur', 'Massal'].forEach((l) => expect(navButton(nav, l)).toBeTruthy());

    await act(async () => navButton(nav, 'Klien').click());
    expect(navButton(nav, 'Klien').getAttribute('aria-current')).toBe('page');
    expect(nav.querySelector('[aria-label="Tambah Klien"]')).not.toBeNull();
    expect(container.textContent).toContain('Pemerintah Desa Tunggal Jaya');

    await act(async () => navButton(nav, 'Beranda').click());
    expect(navButton(nav, 'Beranda').getAttribute('aria-current')).toBe('page');
  });
});
