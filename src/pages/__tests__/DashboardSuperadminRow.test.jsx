import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

vi.mock('../../lib/supabase', () => {
  const profiles = [
    { id: 'sup-1', full_name: 'Pemilik Toko', role: 'superadmin', allowed_paths: null },
    { id: 'adm-budi', full_name: 'Budi', role: 'admin', allowed_paths: null },
  ];
  const result = Promise.resolve({ data: profiles, error: null });
  const chain = { order: () => chain, limit: () => result, then: (...args) => result.then(...args) };
  return { supabase: { from: () => ({ select: () => chain }) } };
});

import DashboardSuperadmin from '../DashboardSuperadmin';

const now = new Date();
const at = (day) => new Date(now.getFullYear(), now.getMonth(), day, 10).toISOString();
const trx = (id, cashier, day) => ({ id, date: at(day), price: 165000, status: 'LUNAS', type: 'retail', customerName: `P${id}`, cashier_name: cashier, payment_method: 'CASH' });

describe('DashboardSuperadmin: Super Administrator tidak muncul di Performa Kasir', () => {
  it('leaves the Super Administrator out of the commission leaderboard even when no profile carries that name', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <DashboardSuperadmin
            session={{ profile: { full_name: 'Super Administrator', role: 'superadmin' } }}
            transactions={[trx('1', 'Super Administrator', 1), trx('2', 'Super Administrator', 2), trx('3', 'Budi', 3)]}
            customers={[]}
            packages={[]}
            companyInfo={{ adminFee: 10000 }}
          />
        </MemoryRouter>
      );
    });
    await act(async () => { await Promise.resolve(); });

    const text = container.textContent;
    expect(text).toContain('Performa Kasir');
    expect(text).not.toContain('2 transaksi lunas bulan ini'); // omset Super Administrator tidak ditampilkan di sini
    expect(text).toContain('1 transaksi lunas bulan ini'); // Budi tetap tampil
    expect(text).not.toContain('Layanan CS (Non-Komisi)'); // badge CS per-baris, beda dari label tab filter "Non-Komisi (0)"
    expect(text).not.toContain('Aturan Akun');
    expect(text).not.toContain('Rp 0 (Super Admin)');
    // hanya admin biasa (Budi) yang punya tombol Transfer Komisi
    expect(text.match(/Transfer Komisi/g)).toHaveLength(1);

    await act(async () => { root.unmount(); });
    container.remove();
  });
});

describe('scrollbar', () => {
  it('is hidden across the whole app while scrolling keeps working', () => {
    const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toContain('scrollbar-width: none');
    expect(css).toContain('::-webkit-scrollbar');
  });
});
