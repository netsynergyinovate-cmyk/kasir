import { describe, it, expect } from 'vitest';
import { parsePelangganRow, mapRunsnetStatus, buildCustomerUpsert } from '../runsnetCustomers';

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
