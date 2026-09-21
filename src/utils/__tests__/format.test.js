import { describe, it, expect } from 'vitest';
import { getInvoiceNumber } from '../format';

describe('getInvoiceNumber', () => {
  it('prefers the Runsnet invoice number (snake_case, as stored in Supabase) when present', () => {
    expect(getInvoiceNumber({ id: 'INV-1', invoice_number: 'INVRT202609002184' })).toBe('INVRT202609002184');
  });

  it('accepts the camelCase form too (freshly built in-memory transaction, not yet round-tripped through the DB)', () => {
    expect(getInvoiceNumber({ id: 'INV-1', invoiceNumber: 'INVRT202609002184' })).toBe('INVRT202609002184');
  });

  it('falls back to the transaction id when there is no Runsnet invoice number', () => {
    expect(getInvoiceNumber({ id: 'INV-1' })).toBe('INV-1');
  });

  it('returns an empty string for a missing transaction', () => {
    expect(getInvoiceNumber(null)).toBe('');
  });
});
