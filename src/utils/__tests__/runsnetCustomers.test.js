import { describe, it, expect } from 'vitest';
import { parsePelangganRow, mapRunsnetStatus, buildCustomerUpsert, planAutoSync } from '../runsnetCustomers';

const sampleRow = [
  "<input type='checkbox' name='select' value='17060001092' onclick='customeurl()'>",
  "<a href='#' id='17060001092' onClick='pelanggandetail(this.id)'><i class='fa fa-server'></i></a> <a href='#' id='17060001092' onClick='pelanggantiket(this.id)'><i class='fa fa-ticket'></i></a> <a href='?x=y'>17060001092</a>",
  'JEFRI NET SYNERGY',
  'HOME SERVER',
  null,
  'Postpaid',
  '2024-08-12',
  '2025-10-21',
  'Tanggal 20',
  "<span style='color: #ff0000'><b>Sambungan Terputus</b></span>",
  "<span style='color:#007f00'>Active</span>",
  "<a href='?x=y' class='btn btn-sm btn-warning'>Edit</a>",
];

describe('mapRunsnetStatus', () => {
  it('maps Active to aktif', () => {
    expect(mapRunsnetStatus('Active')).toBe('aktif');
  });

  it('maps anything else (Isolir, Terminate, ...) to nonaktif', () => {
    expect(mapRunsnetStatus('Isolir')).toBe('nonaktif');
    expect(mapRunsnetStatus('Terminate')).toBe('nonaktif');
    expect(mapRunsnetStatus('')).toBe('nonaktif');
  });
});

describe('parsePelangganRow', () => {
  it('extracts custid from the checkbox value, not by parsing the icon cell', () => {
    expect(parsePelangganRow(sampleRow).custid).toBe('17060001092');
  });

  it('extracts name, package (service), type and mapped status', () => {
    const parsed = parsePelangganRow(sampleRow);
    expect(parsed.name).toBe('JEFRI NET SYNERGY');
    expect(parsed.package).toBe('HOME SERVER');
    expect(parsed.type).toBe('Postpaid');
    expect(parsed.status).toBe('aktif');
  });

  it('returns null when the row has no custid', () => {
    const broken = [...sampleRow];
    broken[0] = "<input type='checkbox' name='select'>";
    expect(parsePelangganRow(broken)).toBeNull();
  });
});

describe('buildCustomerUpsert', () => {
  const parsed = { custid: '17060001092', name: 'JEFRI NET SYNERGY', package: 'HOME SERVER', type: 'Postpaid', status: 'aktif' };

  it('builds a full insert payload (with id = custid) when the customer is new', () => {
    const payload = buildCustomerUpsert(parsed, null);
    expect(payload).toMatchObject({
      id: '17060001092', custid: '17060001092', customer_id: '17060001092',
      name: 'JEFRI NET SYNERGY', package: 'HOME SERVER', status: 'aktif', source: 'Runsnet',
    });
    expect(payload.last_synced).toBeTruthy();
  });

  it('keeps the existing id/phone/address when updating an already-known customer', () => {
    const existing = { id: 'CUST-99', custid: '17060001092', phone: '0812xxxx', address: 'Jl. Lama' };
    const payload = buildCustomerUpsert(parsed, existing);
    expect(payload.id).toBe('CUST-99');
    expect(payload.phone).toBe('0812xxxx');
    expect(payload.address).toBe('Jl. Lama');
    expect(payload.name).toBe('JEFRI NET SYNERGY');
  });
});

describe('planAutoSync', () => {
  const run = (over = {}) => planAutoSync({
    runsnetCustomers: [
      { custid: 'C1', name: 'Budi', package: 'NET 30 Mbps', status: 'aktif' },
      { custid: 'C2', name: 'Sari', package: 'NET 10 Mbps', status: 'aktif' },
      { custid: 'C3', name: 'Baru', package: 'NET 10 Mbps', status: 'aktif' },
      { custid: 'C4', name: 'Lama', package: 'NET 10 Mbps', status: 'aktif' },
    ],
    kasirCustomers: [
      { id: 'C1', custid: 'C1', name: 'Budi', package: 'NET 10 Mbps', status: 'aktif', phone: '08' },
      { id: 'C2', custid: 'C2', name: 'Sari', package: 'NET 10 Mbps', status: 'aktif' },
      { id: 'x', custid: null, name: 'lama ', package: 'NET 10 Mbps', status: 'aktif' },
    ],
    runsnetPackages: [{ name: 'NET 10 Mbps', price: 200000 }, { name: 'NET 30 Mbps', price: 300000 }, { name: 'Gratis', price: 0 }],
    kasirPackages: [{ id: 1, name: 'net 10 mbps', price: 150000 }],
    ...over,
  });

  it('paket berubah di Runsnet: hanya kolom Runsnet yang diperbarui', () => {
    const { customerUpdates } = run();
    expect(customerUpdates).toEqual([expect.objectContaining({ id: 'C1', package: 'NET 30 Mbps', name: 'Budi', status: 'aktif' })]);
    expect(customerUpdates[0]).not.toHaveProperty('phone');
  });

  it('pelanggan Runsnet baru ditambah, kecuali namanya sama dengan pelanggan lama tanpa custid', () => {
    expect(run().customerInserts.map((c) => c.custid)).toEqual(['C3']);
  });

  it('harga paket: perbarui yang beda, tambah yang belum ada, abaikan harga 0', () => {
    const { packageUpdates, packageInserts } = run();
    expect(packageUpdates).toEqual([{ id: 1, price: 200000 }]);
    expect(packageInserts).toEqual([{ name: 'NET 30 Mbps', price: 300000 }]);
  });
});
