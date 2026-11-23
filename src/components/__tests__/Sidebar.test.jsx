import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

const render = (role) => renderToString(
  <MemoryRouter>
    <Sidebar isOpen setIsOpen={() => {}} companyInfo={{ name: 'NetSI' }} session={{ profile: { role, full_name: 'Tester' } }} />
  </MemoryRouter>
).replace(/<!-- -->/g, '');

describe('Sidebar tidak menduplikasi bottom nav', () => {
  it('menyembunyikan menu yang sudah ada di bottom nav', () => {
    const html = render('superadmin');
    for (const label of ['Beranda', 'Pelanggan Retail', 'Rute Kunjungan', 'Kasir (58mm)', 'Pengaturan']) {
      expect(html).not.toContain(label);
    }
  });

  it('tetap menampilkan menu yang tidak ada di bottom nav', () => {
    const html = render('superadmin');
    expect(html).toContain('Tambah Pelanggan');
    expect(html).toContain('Aktivitas Kasir');
    expect(html).toContain('Invoice Instansi');
  });
});
