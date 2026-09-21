import { describe, it, expect } from 'vitest';
import { shouldSyncTransaction, buildSearchQuery, isConfigPlaceholder, describeSyncStatus } from '../runsnetSync';

const trx = (over) => ({
  id: 't1', status: 'LUNAS', type: 'retail', payment_method: 'CASH',
  pppoe_id: null, custid: null, customer_name: 'Ani Santoso', price: 150000,
  ...over,
});

describe('shouldSyncTransaction', () => {
  it('syncs a paid retail transaction', () => {
    expect(shouldSyncTransaction(trx())).toBe(true);
  });

  it('syncs an instansi invoice regardless of status text', () => {
    expect(shouldSyncTransaction(trx({ type: 'instansi', status: 'BELUM' }))).toBe(true);
  });

  it('does not sync an unpaid retail transaction', () => {
    expect(shouldSyncTransaction(trx({ status: 'PENDING' }))).toBe(false);
  });

  it('does not sync a CS (customer service) adjustment, not a real cash collection', () => {
    expect(shouldSyncTransaction(trx({ payment_method: 'CS' }))).toBe(false);
  });
});

describe('buildSearchQuery', () => {
  it('prefers the PPPoE ID when present', () => {
    expect(buildSearchQuery(trx({ pppoe_id: 'pppoe123', custid: 'C9' }))).toBe('pppoe123');
  });

  it('falls back to custid, then the customer name', () => {
    expect(buildSearchQuery(trx({ custid: 'C9' }))).toBe('C9');
    expect(buildSearchQuery(trx())).toBe('Ani Santoso');
  });

  it('returns null when there is nothing usable to search with', () => {
    expect(buildSearchQuery(trx({ customer_name: '' }))).toBeNull();
  });
});

describe('isConfigPlaceholder', () => {
  it('flags the sentinel placeholder value as not yet configured', () => {
    expect(isConfigPlaceholder('REPLACE_ME')).toBe(true);
  });

  it('accepts any other value as configured', () => {
    expect(isConfigPlaceholder('view/control/invoice_search.php')).toBe(false);
  });

  it('treats empty/missing values as not configured', () => {
    expect(isConfigPlaceholder('')).toBe(true);
    expect(isConfigPlaceholder(null)).toBe(true);
    expect(isConfigPlaceholder(undefined)).toBe(true);
  });
});

describe('describeSyncStatus', () => {
  it('labels each known status in plain Indonesian', () => {
    expect(describeSyncStatus('success').text).toBe('Berhasil dikirim');
    expect(describeSyncStatus('failed').text).toBe('Gagal');
    expect(describeSyncStatus('dry_run').text).toMatch(/uji coba/i);
    expect(describeSyncStatus('skipped_disabled').text).toMatch(/mati/i);
    expect(describeSyncStatus('skipped_not_configured').text).toMatch(/dikonfigurasi/i);
  });

  it('falls back to the raw status for anything unknown', () => {
    expect(describeSyncStatus('weird_status').text).toBe('weird_status');
  });
});
