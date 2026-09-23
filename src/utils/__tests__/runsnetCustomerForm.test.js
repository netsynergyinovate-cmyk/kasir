import { describe, it, expect } from 'vitest';
import {
  sanitizePhoneForRunsnet, parseOptionListHtml, buildCustomerPayload, validateCustomerForm, validateStepFields,
} from '../runsnetCustomerForm';

describe('sanitizePhoneForRunsnet', () => {
  it('converts a leading 0 to 62', () => {
    expect(sanitizePhoneForRunsnet('081234567890')).toBe('6281234567890');
  });

  it('strips dashes, spaces and plus signs', () => {
    expect(sanitizePhoneForRunsnet('+62 812-3456-7890')).toBe('6281234567890');
  });

  it('adds 62 when the number has neither 0 nor 62 prefix', () => {
    expect(sanitizePhoneForRunsnet('81234567890')).toBe('6281234567890');
  });

  it('leaves an already-62 number untouched (aside from cleanup)', () => {
    expect(sanitizePhoneForRunsnet('6281234567890')).toBe('6281234567890');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizePhoneForRunsnet('')).toBe('');
    expect(sanitizePhoneForRunsnet(null)).toBe('');
  });
});

describe('parseOptionListHtml', () => {
  it('extracts value/label pairs from a Runsnet <option> fragment', () => {
    const html = "<option value=''>Pilih Profile</option><option value='SRID1'>NET.SI 10 Mbps</option><option value='SRID2'>NET.SI 15 Mbps</option>";
    expect(parseOptionListHtml(html)).toEqual([
      { value: 'SRID1', label: 'NET.SI 10 Mbps' },
      { value: 'SRID2', label: 'NET.SI 15 Mbps' },
    ]);
  });

  it('drops the empty placeholder option', () => {
    const html = "<option value=''>Pilih Cluster</option>";
    expect(parseOptionListHtml(html)).toEqual([]);
  });

  it('returns an empty array for empty/missing input', () => {
    expect(parseOptionListHtml('')).toEqual([]);
    expect(parseOptionListHtml(null)).toEqual([]);
  });
});

describe('buildCustomerPayload', () => {
  it('maps KAsir form fields to the real Runsnet pac_* field names', () => {
    const payload = buildCustomerPayload({
      nama: 'Budi Santoso',
      kontak: '081234567890',
      branchCode: '1706',
      clusterValue: '',
      alamat: 'Jl. Merdeka No.1',
      agent: 'Ahmad',
      jenisTagihan: 'Prepaid',
      profileValue: 'SRID000000000240005',
      biayaBulanan: 200000,
      biayaInstalasi: 300000,
      tanggalSpk: '2026-09-22',
    });
    expect(payload).toMatchObject({
      pac_code: '',
      pac_jenis: 'pppoe',
      pac_nama: 'Budi Santoso',
      pac_kontak: '6281234567890',
      pac_kota: '1706',
      pac_alamat: 'Jl. Merdeka No.1',
      pac_agent: 'Ahmad',
      pac_type: 'Prepaid',
      pac_service: 'SRID000000000240005',
      pac_biaya: '200000',
      pac_installasi: '300000',
      pac_spk: '2026-09-22',
    });
  });

  it('uses a day-of-month string for pac_expired on Postpaid, defaulting to 20', () => {
    const payload = buildCustomerPayload({ jenisTagihan: 'Postpaid' });
    expect(payload.pac_expired).toBe('20');
  });

  it('uses a date for pac_expired on Prepaid', () => {
    const payload = buildCustomerPayload({ jenisTagihan: 'Prepaid', tanggalIsolir: '2026-10-01' });
    expect(payload.pac_expired).toBe('2026-10-01');
  });
});

describe('validateCustomerForm', () => {
  it('lists every missing required field', () => {
    expect(validateCustomerForm({})).toEqual([
      'Nama pelanggan wajib diisi.',
      'Nomor kontak wajib diisi.',
      'Cabang (Branch) wajib dipilih.',
      'Alamat wajib diisi.',
      'Paket (Profile) wajib dipilih.',
      'Biaya Bulanan wajib lebih dari Rp 0 (cek harga paket, jangan kirim dengan Rp 0).',
    ]);
  });

  it('returns no errors when all required fields are filled', () => {
    expect(validateCustomerForm({
      nama: 'Budi', kontak: '0812', branchCode: '1706', alamat: 'Jl. A', profileValue: 'SRID1', biayaBulanan: 200000,
    })).toEqual([]);
  });

  it('rejects a Biaya Bulanan of 0 even when every other field is filled', () => {
    expect(validateCustomerForm({
      nama: 'Budi', kontak: '0812', branchCode: '1706', alamat: 'Jl. A', profileValue: 'SRID1', biayaBulanan: 0,
    })).toEqual(['Biaya Bulanan wajib lebih dari Rp 0 (cek harga paket, jangan kirim dengan Rp 0).']);
  });
});

describe('validateStepFields', () => {
  it('step 1 requires nama and kontak', () => {
    expect(validateStepFields(1, {})).toEqual([
      'Nama pelanggan wajib diisi.',
      'Nomor kontak wajib diisi.',
    ]);
    expect(validateStepFields(1, { nama: 'Budi', kontak: '0812' })).toEqual([]);
  });

  it('step 2 requires branchCode and alamat', () => {
    expect(validateStepFields(2, {})).toEqual([
      'Cabang (Branch) wajib dipilih.',
      'Alamat wajib diisi.',
    ]);
    expect(validateStepFields(2, { branchCode: '1706', alamat: 'Jl. A' })).toEqual([]);
  });

  it('step 3 requires profileValue and a positive biayaBulanan', () => {
    expect(validateStepFields(3, {})).toEqual([
      'Paket (Profile) wajib dipilih.',
      'Biaya Bulanan wajib lebih dari Rp 0 (cek harga paket, jangan kirim dengan Rp 0).',
    ]);
    expect(validateStepFields(3, { profileValue: 'SRID1', biayaBulanan: 0 })).toEqual([
      'Biaya Bulanan wajib lebih dari Rp 0 (cek harga paket, jangan kirim dengan Rp 0).',
    ]);
    expect(validateStepFields(3, { profileValue: 'SRID1', biayaBulanan: 200000 })).toEqual([]);
  });

  it('step 4 has no extra required fields (Username/Secret are optional)', () => {
    expect(validateStepFields(4, {})).toEqual([]);
  });
});
