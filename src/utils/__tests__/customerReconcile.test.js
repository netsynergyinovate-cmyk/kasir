import { describe, it, expect } from 'vitest';
import { matchCustomersByName, buildReconciledCustomer } from '../customerReconcile';

const oldCust = (id, name, extra = {}) => ({ id, name, nickname: null, address: null, phone: null, due_date: null, price: null, lat: null, lng: null, route_order: null, ...extra });
const runsnetCust = (custid, name, extra = {}) => ({ custid, name, package: 'HOME SERVER', type: 'Postpaid', status: 'aktif', ...extra });

describe('matchCustomersByName', () => {
  it('pairs an old customer with the Runsnet customer of the same name (case-insensitive, trimmed)', () => {
    const result = matchCustomersByName(
      [oldCust('CUST-1', ' roedi filani ')],
      [runsnetCust('17060001849', 'ROEDI FILANI')],
    );
    expect(result.matched).toEqual([{ old: oldCust('CUST-1', ' roedi filani '), runsnet: runsnetCust('17060001849', 'ROEDI FILANI') }]);
    expect(result.unmatchedOld).toEqual([]);
  });

  it('lists an old customer with no name match as unmatched, without guessing', () => {
    const result = matchCustomersByName([oldCust('CUST-1', 'NAMA TIDAK ADA DI RUNSNET')], [runsnetCust('X', 'LAIN')]);
    expect(result.matched).toEqual([]);
    expect(result.unmatchedOld.map((c) => c.id)).toEqual(['CUST-1']);
  });

  it('flags a name that matches more than one Runsnet customer as ambiguous, and does not pair it', () => {
    const result = matchCustomersByName(
      [oldCust('CUST-1', 'SUJARWO')],
      [runsnetCust('A', 'SUJARWO'), runsnetCust('B', 'SUJARWO')],
    );
    expect(result.matched).toEqual([]);
    expect(result.ambiguous.map((c) => c.id)).toEqual(['CUST-1']);
  });

  it('never pairs the same Runsnet customer to two different old customers (first one wins, the rest go to ambiguous)', () => {
    const result = matchCustomersByName(
      [oldCust('CUST-1', 'BUDI'), oldCust('CUST-2', 'BUDI')],
      [runsnetCust('X', 'BUDI')],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].old.id).toBe('CUST-1');
    expect(result.ambiguous.map((c) => c.id)).toEqual(['CUST-2']);
  });
});

describe('buildReconciledCustomer', () => {
  it('takes identity/status fields from Runsnet, but keeps the KAsir-only fields (nickname, phone, address, due_date, price, route data)', () => {
    const old = oldCust('CUST-1', 'Roedi Filani', {
      nickname: 'Pak Roedi', phone: '0812', address: 'Jl. Lama', due_date: 20, price: 200000,
      lat: -6.2, lng: 106.8, route_order: 3,
    });
    const runsnet = runsnetCust('17060001849', 'ROEDI FILANI', { package: 'HOME SERVER 10 Mbps', status: 'aktif' });

    const result = buildReconciledCustomer(old, runsnet);

    expect(result).toMatchObject({
      id: '17060001849',
      custid: '17060001849',
      customer_id: '17060001849',
      name: 'ROEDI FILANI',
      package: 'HOME SERVER 10 Mbps',
      status: 'aktif',
      source: 'Runsnet',
      nickname: 'Pak Roedi',
      phone: '0812',
      address: 'Jl. Lama',
      due_date: 20,
      price: 200000,
      lat: -6.2,
      lng: 106.8,
      route_order: 3,
    });
    expect(result.last_synced).toBeTruthy();
  });
});
