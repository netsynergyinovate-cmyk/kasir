import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';

const render = (props) => renderToString(
  <MemoryRouter>
    <Dashboard transactions={[]} packages={[]} companyInfo={{ adminName: 'CS PT NET.SI' }} {...props} />
  </MemoryRouter>
).replace(/<!-- -->/g, '');

const routeCustomers = [
  { id: 'c1', name: 'Budi Tujuan Pertama', address: 'Jl. Melati 2', route_order: 1, lat: -6.21, lng: 106.81, status: 'aktif' },
  { id: 'c2', name: 'Citra Tujuan Kedua', address: 'Jl. Kenanga 3', route_order: 2, lat: -6.22, lng: 106.82, status: 'aktif' },
];

describe('Dashboard route overview (what an admin sees on the home page)', () => {
  it('shows the route card with the next destination and navigation link', () => {
    const html = render({ customers: routeCustomers, visits: [] });
    expect(html).toContain('Rute Kunjungan');
    expect(html).toContain('Tujuan berikutnya');
    expect(html).toContain('Budi Tujuan Pertama');
    expect(html).toContain('Setelah ini: <b>Citra Tujuan Kedua</b>');
    expect(html).toContain('https://www.google.com/maps/dir/?api=1&amp;destination=-6.21,106.81');
  });

  it('lists every stop with its status and lets the admin log a visit right on the dashboard', () => {
    const html = render({ customers: routeCustomers, visits: [] });
    expect(html).toContain('Urutan kunjungan');
    expect(html).toContain('Citra Tujuan Kedua');
    expect(html).toContain('Catat Kunjungan');
    expect(html).not.toContain('href="/rute"');
  });

  it('automatically shows "Sudah terbayarkan" once the customer has paid this month', () => {
    const now = new Date();
    const paid = [{ id: 't1', type: 'retail', status: 'LUNAS', customerName: 'Budi Tujuan Pertama', date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString() }];
    const html = render({ customers: routeCustomers, visits: [], transactions: paid });
    expect(html).toContain('Sudah terbayarkan');
    // Budi sudah bayar, jadi tujuan berikutnya pindah ke Citra.
    const next = html.slice(html.indexOf('Tujuan berikutnya'));
    expect(next.slice(0, 400)).toContain('Citra Tujuan Kedua');
  });

  it('still shows a card explaining that there is no route yet', () => {
    const html = render({ customers: [{ id: 'c1', name: 'Ani', route_order: null, status: 'aktif' }], visits: [] });
    expect(html).toContain('Belum ada rute kunjungan');
  });

  it('explains that the map needs coordinates when the route has none', () => {
    const html = render({ customers: [{ id: 'c1', name: 'Ani', route_order: 1, lat: null, lng: null, status: 'aktif' }], visits: [] });
    expect(html).toContain('Peta muncul setelah koordinat rumah diisi');
  });

  it('shows the Atur Rute link only when the viewer may manage the route', () => {
    expect(render({ customers: routeCustomers, visits: [], canManageRoute: true })).toContain('href="/rute"');
    expect(render({ customers: routeCustomers, visits: [] })).not.toContain('href="/rute"');
  });
});
