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

  const today = new Date();
  const visitToday = (customerId, outcome = 'tidak_ada_di_rumah') => ({
    id: `v-${customerId}`,
    customer_id: customerId,
    outcome,
    available_on: null,
    visited_at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0).toISOString(),
  });

  // Hanya kartu rute (sampai bagian "Periode" milik dashboard lain).
  const routeCard = (html) => html.slice(html.indexOf('Rute Kunjungan'), html.indexOf('Periode'));

  it('hides customers who already have visit info so the dashboard only lists who still needs a visit', () => {
    const card = routeCard(render({ customers: routeCustomers, visits: [visitToday('c1')] }));
    const list = card.slice(card.indexOf('Urutan kunjungan'));
    expect(list).toContain('Citra Tujuan Kedua');
    expect(card).not.toContain('Budi Tujuan Pertama');
    // tujuan berikutnya pindah ke rumah yang masih perlu didatangi
    expect(card.slice(card.indexOf('Tujuan berikutnya'), card.indexOf('Urutan kunjungan'))).toContain('Citra Tujuan Kedua');
  });

  it('summarises the hidden customers as waiting or paid', () => {
    const card = routeCard(render({ customers: routeCustomers, visits: [visitToday('c1')] }));
    expect(card).toMatch(/<b>1<\/b> menunggu janji/);
    expect(card).toMatch(/<b>0<\/b> sudah terbayarkan/);
  });

  it('says everything is handled when nobody needs a visit', () => {
    const html = render({ customers: routeCustomers, visits: [visitToday('c1'), visitToday('c2', 'uang_belum_ada')] });
    expect(html).toContain('Semua rumah di rute sudah beres');
    expect(html).not.toContain('Urutan kunjungan');
  });

  it('tells the admin that the location is shared and the route starts from their position', () => {
    const html = render({ customers: routeCustomers, visits: [], locationStatus: 'active', myPosition: { lat: -6.2, lng: 106.8 }, origin: { lat: -6.2, lng: 106.8 } });
    expect(html).toContain('Lokasi Anda dibagikan ke superadmin');
  });

  it('asks the admin to allow location access when it was denied', () => {
    const html = render({ customers: routeCustomers, visits: [], locationStatus: 'denied' });
    expect(html).toContain('Izin lokasi ditolak');
  });

  it('shows no location note when tracking is off (superadmin)', () => {
    const html = render({ customers: routeCustomers, visits: [], locationStatus: 'off' });
    expect(html).not.toContain('Lokasi Anda dibagikan');
    expect(html).not.toContain('Izin lokasi ditolak');
  });

  it('offers an Aktifkan lokasi button while waiting for or after denying the permission', () => {
    ['waiting', 'denied', 'unavailable'].forEach((locationStatus) => {
      const html = render({ customers: routeCustomers, visits: [], locationStatus, onRetryLocation: () => {} });
      expect(html).toContain('Aktifkan lokasi');
    });
  });

  it('explains the https requirement instead of a retry button when the page is not secure', () => {
    const html = render({ customers: routeCustomers, visits: [], locationStatus: 'insecure', onRetryLocation: () => {} });
    expect(html).toMatch(/https/i);
    expect(html).not.toContain('Aktifkan lokasi');
  });

  it('shows no retry button once the location is active', () => {
    const html = render({ customers: routeCustomers, visits: [], locationStatus: 'active', onRetryLocation: () => {} });
    expect(html).not.toContain('Aktifkan lokasi');
  });
});
