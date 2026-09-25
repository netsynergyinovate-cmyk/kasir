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

  it('checking "Lihat Data Pelanggan" also enables the Pelanggan menu so the admin can actually open it', async () => {
    const admin = { id: 'adm-1', full_name: 'Admin Satu', allowed_paths: { paths: ['/pos'], permissions: ['pos.view'] } };

    await act(async () => {
      root.render(<AdminAccessModal admin={admin} onClose={() => {}} onSaved={() => {}} />);
    });

    const menuCheckbox = () => findByText('label', 'Pelanggan').querySelector('input[type="checkbox"]');
    expect(menuCheckbox().checked).toBe(false);

    await click(findByText('button', 'Manajemen Pelanggan'));
    await click(findByText('label', 'Lihat Data Pelanggan').querySelector('input'));

    expect(menuCheckbox().checked).toBe(true);

    await click(findByText('button', 'Simpan Akses'));
    const saved = updateMock.mock.calls[0][0].allowed_paths;
    expect(saved.paths).toContain('/customers');
    expect(saved.permissions).toContain('customers.view');
  });

  it('unchecking a permission leaves the menu as it was', async () => {
    const admin = { id: 'adm-2', full_name: 'Admin Dua', allowed_paths: { paths: ['/customers'], permissions: ['customers.view'] } };

    await act(async () => {
      root.render(<AdminAccessModal admin={admin} onClose={() => {}} onSaved={() => {}} />);
    });

    await click(findByText('button', 'Manajemen Pelanggan'));
    await click(findByText('label', 'Lihat Data Pelanggan').querySelector('input'));
    await click(findByText('button', 'Simpan Akses'));

    const saved = updateMock.mock.calls[0][0].allowed_paths;
    expect(saved.permissions).not.toContain('customers.view');
    expect(saved.paths).toContain('/customers');
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
