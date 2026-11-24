import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../components/RouteMap', () => ({ default: () => <div data-testid="route-map" /> }));
vi.mock('../../utils/routing', () => ({ fetchRoadRoute: () => Promise.resolve(null) }));

const inserted = [];
vi.mock('../../lib/supabase', () => {
  const query = {
    select: () => query, gte: () => query, lt: () => query, order: () => query,
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      from: () => ({
        ...query,
        insert: (row) => {
          inserted.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: String(inserted.length), created_at: new Date().toISOString(), ...row }, error: null }) }) };
        },
      }),
    },
  };
});

import StartOnWork from '../StartOnWork';
import StartWorkCard from '../../components/StartWorkCard';
import { readWork, writeWork } from '../../utils/startOnWork';

const session = { user: { id: 'u1' }, profile: { role: 'admin', full_name: 'Wahyu' } };
const customers = [
  { id: 'c1', name: 'Ani', address: 'Jl. Mawar', route_order: 1, lat: -6.2, lng: 106.8, status: 'aktif' },
  { id: 'c2', name: 'Budi', address: 'Jl. Melati', route_order: 2, lat: -6.21, lng: 106.81, status: 'aktif' },
];
const far = { lat: -6.25, lng: 106.85, accuracy: 10 };
const atAni = { lat: -6.2001, lng: 106.8, accuracy: 10 };

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe('Start On Work', () => {
  beforeEach(() => { localStorage.clear(); inserted.length = 0; });

  it('shows Mari Mulai on Beranda only on a work day, and starting logs "mulai"', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    const iso = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const card = (workRange) => (
      <MemoryRouter>
        <StartWorkCard session={{ ...session, profile: { ...session.profile, allowed_paths: { paths: ['/'], permissions: ['work.view'], work_range: workRange } } }} position={far} />
      </MemoryRouter>
    );

    await act(async () => root.render(card({ from: iso(1), to: iso(5) })));
    expect(container.textContent).toContain('di luar tanggal kerja');

    await act(async () => root.render(card({ from: iso(-1), to: iso(0) })));
    const startButton = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Mari Mulai'));
    await act(async () => startButton.click());
    await flush();
    expect(inserted.map((row) => row.event)).toEqual(['mulai']);
    expect(readWork('u1')).toMatchObject({ targetId: null, doneIds: [] });
    act(() => root.unmount());
  });

  it('routes to the first stop, locks on arrival, then moves on after the report', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const onAddVisit = vi.fn(() => Promise.resolve(true));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const view = (position) => (
      <MemoryRouter>
        <StartOnWork session={session} customers={customers} position={position} routeOrigin={position} locationStatus="active" onAddVisit={onAddVisit} />
      </MemoryRouter>
    );

    writeWork({ userId: 'u1', sessionId: '00000000-0000-0000-0000-000000000001', startedAt: new Date().toISOString(), targetId: null, arrivedId: null, doneIds: [] });
    await act(async () => root.render(view(far)));
    await flush();

    expect(container.textContent).toContain('Ani');
    expect(inserted.map((row) => row.event)).toEqual(['berangkat']);

    await act(async () => root.render(view(atAni)));
    await flush();
    expect(readWork('u1').arrivedId).toBe('c1');
    expect(document.body.textContent).toContain('Anda sudah sampai');
    expect(inserted.at(-1)).toMatchObject({ event: 'tiba', customer_id: 'c1' });

    const sheet = document.querySelector('.fixed');
    const notHome = [...sheet.querySelectorAll('button')].find((b) => b.textContent === 'Tidak ada di rumah');
    await act(async () => notHome.click());
    const submit = [...sheet.querySelectorAll('button')].find((b) => b.textContent === 'Kirim Laporan');
    await act(async () => submit.click());
    await flush();

    expect(onAddVisit).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 'c1', outcome: 'tidak_ada_di_rumah' }));
    expect(readWork('u1')).toMatchObject({ arrivedId: null, targetId: 'c2', doneIds: ['c1'] });
    expect(inserted.slice(-2).map((row) => row.event)).toEqual(['tidak_ada_di_rumah', 'berangkat']);

    // GPS error: lapor manual dari kartu tujuan (Budi) tanpa tiba; "Ada di rumah" tanpa hak bayar tidak muncul.
    const manual = container.querySelector('details');
    expect([...manual.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Ada di rumah');
    const later = [...manual.querySelectorAll('button')].find((b) => b.textContent === 'Ada di rumah, bayar nanti');
    await act(async () => later.click());
    const send = [...manual.querySelectorAll('button')].find((b) => b.textContent === 'Kirim Laporan');
    await act(async () => send.click());
    await flush();
    expect(onAddVisit).toHaveBeenLastCalledWith(expect.objectContaining({ customer_id: 'c2', outcome: 'uang_belum_ada' }));
    expect(inserted.at(-1)).toMatchObject({ event: 'uang_belum_ada', customer_id: 'c2' });
    expect(inserted.at(-1).note).toContain('Lapor manual');

    act(() => root.unmount());
    container.remove();
  });
});
