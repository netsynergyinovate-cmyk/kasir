import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const updateMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => (table === 'customers'
        ? { order: () => Promise.resolve({ data: [] }) }
        : { eq: () => Promise.resolve({ data: [] }) }),
      update: (payload) => {
        updateMock(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

import AdminAccessModal from '../AdminAccessModal';
import { ALL_PERMISSIONS, CONFIGURABLE_ADMIN_MENUS } from '../../utils/permissions';

describe('AdminAccessModal: hak akses fitur membuka menu halamannya', () => {
  let container;
  let root;

  beforeEach(() => {
    updateMock.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const click = async (el) => {
    await act(async () => { el.click(); });
  };

  const findByText = (selector, text) =>
    Array.from(container.querySelectorAll(selector)).find((el) => el.textContent.includes(text));

  const switchFor = (label) => container.querySelector(`input[aria-label="${label}"]`);

  it('turning on a feature also opens its page (menu + page-view permission)', async () => {
    const admin = { id: 'adm-1', full_name: 'Admin Satu', allowed_paths: { paths: ['/pos'], permissions: ['pos.view'] } };

    await act(async () => {
      root.render(<AdminAccessModal admin={admin} onClose={() => {}} onSaved={() => {}} />);
    });

    expect(switchFor('Buka halaman Manajemen Pelanggan').checked).toBe(false);

    await click(findByText('button', 'Manajemen Pelanggan'));
    await click(switchFor('Tambah Pelanggan Baru'));

    expect(switchFor('Buka halaman Manajemen Pelanggan').checked).toBe(true);

    await click(findByText('button', 'Simpan Akses'));
    const saved = updateMock.mock.calls[0][0].allowed_paths;
    expect(saved.paths).toContain('/customers');
    expect(saved.permissions).toEqual(expect.arrayContaining(['customers.view', 'customers.create']));
  });

  it('closing a page removes its menu and page-view permission together', async () => {
    const admin = { id: 'adm-2', full_name: 'Admin Dua', allowed_paths: { paths: ['/customers'], permissions: ['customers.view'] } };

    await act(async () => {
      root.render(<AdminAccessModal admin={admin} onClose={() => {}} onSaved={() => {}} />);
    });

    await click(switchFor('Buka halaman Manajemen Pelanggan'));
    await click(findByText('button', 'Simpan Akses'));

    const saved = updateMock.mock.calls[0][0].allowed_paths;
    expect(saved.permissions).not.toContain('customers.view');
    expect(saved.paths).not.toContain('/customers');
  });

  it('the "Akses Penuh" preset grants every permission and page', async () => {
    const admin = { id: 'adm-4', full_name: 'Admin Empat', allowed_paths: { paths: ['/pos'], permissions: ['pos.view'] } };

    await act(async () => {
      root.render(<AdminAccessModal admin={admin} onClose={() => {}} onSaved={() => {}} />);
    });

    await click(findByText('button', 'Akses Penuh'));
    await click(findByText('button', 'Simpan Akses'));

    const saved = updateMock.mock.calls[0][0].allowed_paths;
    expect(saved.permissions).toEqual(ALL_PERMISSIONS);
    expect(saved.paths).toEqual(CONFIGURABLE_ADMIN_MENUS.map((m) => m.path));
  });

  it('keeps the bonuses and payouts granted by the Superadmin when access is saved', async () => {
    const bonuses = [{ id: 'b1', amount: 50000, period: '2026-09', notes: 'Target' }];
    const commissions = [{ id: 'c1', amount: 10000, status: 'TERKIRIM' }];
    const admin = { id: 'adm-3', full_name: 'Admin Tiga', allowed_paths: { paths: ['/pos'], permissions: ['pos.view'], commissions, bonuses } };

    await act(async () => {
      root.render(<AdminAccessModal admin={admin} onClose={() => {}} onSaved={() => {}} />);
    });
    await click(findByText('button', 'Simpan Akses'));

    const saved = updateMock.mock.calls[0][0].allowed_paths;
    expect(saved.bonuses).toEqual(bonuses);
    expect(saved.commissions).toEqual(commissions);
  });
});
