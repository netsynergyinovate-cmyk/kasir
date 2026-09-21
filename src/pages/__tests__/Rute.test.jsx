import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// Leaflet butuh browser sungguhan; peta tidak diuji di sini (efeknya tidak jalan di renderToString).
vi.mock('../../components/RouteMap', () => ({ default: () => <div data-testid="route-map" /> }));
vi.mock('../../components/LocationPicker', () => ({ default: () => <div /> }));

import Rute from '../Rute';

const now = new Date();
const dayOffset = (offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 9, 0, 0);
// Tanggal tetap di bulan berjalan supaya tes tidak bergantung pada hari dalam bulan.
const thisMonth = (day) => new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0).toISOString();

const customers = [
  { id: 'c1', name: 'Ani Sudah Dikunjungi', address: 'Jl. Mawar 1', route_order: 1, lat: -6.2, lng: 106.8, status: 'aktif' },
  { id: 'c2', name: 'Budi Belum Bayar', address: 'Jl. Melati 2', route_order: 2, lat: -6.21, lng: 106.81, status: 'aktif', phone: '0812' },
  { id: 'c3', name: 'Citra Sudah Bayar', address: 'Jl. Kenanga 3', route_order: 3, lat: -6.22, lng: 106.82, status: 'aktif' },
  { id: 'c4', name: 'Dewi Di Luar Rute', address: 'Jl. Anggrek 4', route_order: null, status: 'aktif' },
];

const visits = [
  { id: 'v1', customer_id: 'c1', outcome: 'tidak_ada_di_rumah', available_on: null, visited_at: dayOffset(0).toISOString() },
];

const transactions = [
  { id: 't1', type: 'retail', status: 'LUNAS', customerName: 'Citra Sudah Bayar', date: thisMonth(1) },
];

const render = (role) => renderToString(
  <Rute customers={customers} transactions={transactions} visits={visits} role={role} onAddVisit={() => {}} onUpdateCustomerRoute={() => {}} />
).replace(/<!-- -->/g, '');

describe('Rute Kunjungan page', () => {
  const adminHtml = render('admin');

  it('picks the first customer that still needs a visit as the next destination', () => {
    const next = adminHtml.slice(adminHtml.indexOf('Tujuan berikutnya'));
    expect(next.indexOf('Budi Belum Bayar')).toBeGreaterThan(-1);
    // Ani sudah dicoba hari ini dan Citra sudah bayar, jadi bukan tujuan berikutnya.
    expect(next.slice(0, next.indexOf('Urutan Kunjungan')).indexOf('Ani Sudah Dikunjungi')).toBe(-1);
  });

  it('shows the visit status labels', () => {
    expect(adminHtml).toContain('Tidak ada di rumah');
    expect(adminHtml).toContain('Sudah bayar');
    expect(adminHtml).toContain('Belum dikunjungi');
  });

  it('offers Google Maps navigation and the visit logging button', () => {
    expect(adminHtml).toContain('https://www.google.com/maps/dir/?api=1&amp;destination=-6.21,106.81');
    expect(adminHtml).toContain('Catat Kunjungan');
  });

  it('does not offer route editing to an admin', () => {
    expect(adminHtml).not.toContain('Atur Rute');
    expect(adminHtml).not.toContain('Dewi Di Luar Rute');
  });

  it('offers route editing to the superadmin', () => {
    expect(render('superadmin')).toContain('Atur Rute');
  });
});

describe('Rute Kunjungan page without a route yet', () => {
  const emptyHtml = (role, list) => renderToString(
    <Rute customers={list} transactions={[]} visits={[]} role={role} onAddVisit={() => {}} onUpdateCustomerRoute={() => {}} />
  ).replace(/<!-- -->/g, '');

  it('guides the superadmin to build the route when the route is empty', () => {
    const html = emptyHtml('superadmin', [{ id: 'c1', name: 'Ani', route_order: null }]);
    expect(html).toContain('Belum ada rumah di rute');
    expect(html).toContain('Mulai Atur Rute');
  });

  it('tells an admin that the superadmin has not built the route yet', () => {
    const html = emptyHtml('admin', [{ id: 'c1', name: 'Ani', route_order: null }]);
    expect(html).toContain('Superadmin belum menyusun rute');
    expect(html).not.toContain('Mulai Atur Rute');
  });

  it('explains that the map appears once coordinates are filled in', () => {
    const html = emptyHtml('superadmin', [{ id: 'c1', name: 'Ani', address: 'Jl. A', route_order: 1, lat: null, lng: null }]);
    expect(html).toContain('Peta muncul setelah koordinat rumah diisi');
    expect(html).not.toContain('data-testid="route-map"');
  });
});
