import { describe, it, expect } from 'vitest';
import { shouldSyncTransaction, buildSearchQuery, isConfigPlaceholder, describeSyncStatus, stripHtml, parseInvoiceListResponse, syncToastTone } from '../runsnetSync';

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

describe('stripHtml', () => {
  it('removes tags and returns the trimmed inner text', () => {
    expect(stripHtml("<a href='#' id='INVRT202609002184'>INVRT202609002184</a>")).toBe('INVRT202609002184');
    expect(stripHtml('  plain text  ')).toBe('plain text');
    expect(stripHtml(null)).toBe('');
  });
});

describe('parseInvoiceListResponse', () => {
  const okResponse = {
    draw: 1,
    recordsTotal: 33,
    recordsFiltered: 1,
    data: [[
      "<input type='checkbox' name='select' value='INVRT202609002184'>",
      "<a href='#' id='INVRT202609002184'>INVRT202609002184</a>",
      "<a href='?x=y'>17060001849</a>",
      'ROEDI FILANI',
      '2026-09-24', '2026-09-24', '200,000', '200,000', null,
      '<a>...</a>', '<a>...</a>', '<a>...</a>',
    ]],
  };

  it('extracts the invoice code from the first matching row', () => {
    expect(parseInvoiceListResponse(okResponse)).toEqual({ id: 'INVRT202609002184' });
  });

  it('returns null when nothing was found', () => {
    expect(parseInvoiceListResponse({ draw: 1, recordsTotal: 33, recordsFiltered: 0, data: [] })).toBeNull();
  });
});

describe('parseInvoiceListResponse with ambiguous matches', () => {
  const rowFor = (code, custid) => [
    "<input type='checkbox'>",
    `<a id='${code}'>${code}</a>`,
    `<a href='#'>${custid}</a>`,
    'Nama Mirip',
    '2026-09-24', '2026-09-24', '200,000', '200,000', null, '<a>x</a>', '<a>x</a>', '<a>x</a>',
  ];

  it('refuses to pick a winner when the search matches more than one invoice', () => {
    const response = { draw: 1, recordsTotal: 2, recordsFiltered: 2, data: [rowFor('INVRT1', 'A'), rowFor('INVRT2', 'B')] };
    expect(parseInvoiceListResponse(response)).toBeNull();
  });

  it('still returns the single match when there is exactly one', () => {
    const response = { draw: 1, recordsTotal: 2, recordsFiltered: 1, data: [rowFor('INVRT1', 'A')] };
    expect(parseInvoiceListResponse(response)).toEqual({ id: 'INVRT1' });
  });
});

describe('syncToastTone', () => {
  it('is ok for success', () => {
    expect(syncToastTone('success')).toBe('ok');
  });
  it('is bad for failed', () => {
    expect(syncToastTone('failed')).toBe('bad');
  });
  it('is info for everything else (dry_run, skipped_*)', () => {
    expect(syncToastTone('dry_run')).toBe('info');
    expect(syncToastTone('skipped_disabled')).toBe('info');
    expect(syncToastTone('skipped_not_configured')).toBe('info');
  });
});
