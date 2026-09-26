import { describe, it, expect } from 'vitest';
import { runsnetCodeOf, describeRunsnetStatus, isRunsnetMismatch } from '../runsnetStatus';

const withCode = { id: 'INV-1', type: 'retail', status: 'LUNAS', invoice_number: 'INVRT202609001239' };
const localOnly = { id: 'INV-2', type: 'retail', status: 'LUNAS', invoice_number: null };

describe('runsnetCodeOf', () => {
  it('returns the Runsnet invoice code, or null for a local-only INV- number', () => {
    expect(runsnetCodeOf(withCode)).toBe('INVRT202609001239');
    expect(runsnetCodeOf(localOnly)).toBeNull();
    expect(runsnetCodeOf({ id: 'INV-3', invoice_number: 'INV-3' })).toBeNull();
  });
});

describe('describeRunsnetStatus', () => {
  it('shows the real Runsnet status in plain Indonesian', () => {
    expect(describeRunsnetStatus(withCode, 'PAID')).toMatchObject({ text: 'PAID di Runsnet', tone: 'ok' });
    expect(describeRunsnetStatus(withCode, 'PENDING')).toMatchObject({ text: 'BELUM lunas di Runsnet', tone: 'bad' });
    expect(describeRunsnetStatus(withCode, 'NOT_FOUND').tone).toBe('warn');
  });

  it('says so when the transaction has no Runsnet invoice, or when the status is still being read', () => {
    expect(describeRunsnetStatus(localOnly, undefined).key).toBe('local');
    expect(describeRunsnetStatus(withCode, undefined).key).toBe('checking');
  });
});

describe('isRunsnetMismatch', () => {
  it('flags a LUNAS transaction whose Runsnet invoice is not PAID', () => {
    expect(isRunsnetMismatch(withCode, 'PENDING')).toBe(true);
    expect(isRunsnetMismatch(withCode, 'CANCEL')).toBe(true);
  });

  it('also flags a KASBON (underpaid) transaction — it is synced as PAID too, so it should match', () => {
    expect(isRunsnetMismatch({ ...withCode, status: 'KASBON' }, 'PENDING')).toBe(true);
  });

  it('does not flag PAID, unknown, local-only, a CS-adjusted KASBON, or instansi', () => {
    expect(isRunsnetMismatch(withCode, 'PAID')).toBe(false);
    expect(isRunsnetMismatch(withCode, undefined)).toBe(false);
    expect(isRunsnetMismatch(localOnly, 'PENDING')).toBe(false);
    expect(isRunsnetMismatch({ ...withCode, status: 'KASBON', payment_method: 'CS' }, 'PENDING')).toBe(false);
    expect(isRunsnetMismatch({ ...withCode, type: 'instansi' }, 'PENDING')).toBe(false);
  });
});
