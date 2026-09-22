import { describe, it, expect } from 'vitest';
import {
  getRomanMonth,
  generateInvoiceNumber,
  generateFakturNumber,
  invoiceKindFromNumber,
  terbilang,
  amountInWords,
  billingPeriod,
  monthRange,
  nextSequence,
  resolvePackagePrice,
  formatNumber,
  formatDateIndo,
  formatDateIndoShort,
} from '../instansiInvoice';

describe('getRomanMonth', () => {
  it('converts month number to roman numeral', () => {
    expect(getRomanMonth(1)).toBe('I');
    expect(getRomanMonth(9)).toBe('IX');
    expect(getRomanMonth(12)).toBe('XII');
  });
});

describe('generateInvoiceNumber', () => {
  it('formats INV-sequence/clientCode/NSI/romanMonth/year', () => {
    expect(generateInvoiceNumber(3, 9, 2026, 'SDN01')).toBe('INV-003/SDN01/NSI/IX/2026');
  });
});

describe('generateFakturNumber', () => {
  it('formats FKT-sequence-clientCode-NSI-romanMonth-year', () => {
    expect(generateFakturNumber(12, 1, 2026, 'SDN01')).toBe('FKT-012-SDN01-NSI-I-2026');
  });
});

describe('invoiceKindFromNumber', () => {
  it('recognizes faktur numbers by their FKT- prefix', () => {
    expect(invoiceKindFromNumber('FKT-001-SDN01-NSI-I-2026')).toBe('faktur');
    expect(invoiceKindFromNumber('INV-001/SDN01/NSI/I/2026')).toBe('invoice');
  });
});

describe('terbilang', () => {
  it('spells out numbers in Indonesian', () => {
    expect(terbilang(0)).toBe('');
    expect(terbilang(11)).toBe('Sebelas');
    expect(terbilang(15)).toBe('Lima Belas');
    expect(terbilang(300000)).toBe('Tiga Ratus Ribu');
    expect(terbilang(1500000)).toBe('Satu Juta Lima Ratus Ribu');
  });
});

describe('amountInWords', () => {
  it('uppercases and appends RUPIAH', () => {
    expect(amountInWords(300000)).toBe('TIGA RATUS RIBU RUPIAH');
  });

  it('returns NOL RUPIAH for zero or negative amounts', () => {
    expect(amountInWords(0)).toBe('NOL RUPIAH');
  });
});

describe('billingPeriod', () => {
  it('issues on the 1st and is due on the last day of the month', () => {
    expect(billingPeriod(9, 2026)).toEqual({ issuedDate: '2026-09-01', dueDate: '2026-09-30' });
  });

  it('treats February as always due on the 28th', () => {
    expect(billingPeriod(2, 2028)).toEqual({ issuedDate: '2028-02-01', dueDate: '2028-02-28' });
  });
});

describe('monthRange', () => {
  it('returns an inclusive list of months', () => {
    expect(monthRange(9, 9)).toEqual([9]);
    expect(monthRange(9, 11)).toEqual([9, 10, 11]);
  });
});

describe('nextSequence', () => {
  it('finds the next number after the highest used INV- sequence', () => {
    expect(nextSequence(['INV-001/A/NSI/I/2026', 'INV-005/B/NSI/II/2026'], 'invoice')).toBe(6);
  });

  it('tracks INV- and FKT- sequences independently', () => {
    const numbers = ['INV-010/A/NSI/I/2026', 'FKT-002-A-NSI-I-2026'];
    expect(nextSequence(numbers, 'invoice')).toBe(11);
    expect(nextSequence(numbers, 'faktur')).toBe(3);
  });

  it('starts at 1 when there are no existing invoices', () => {
    expect(nextSequence([], 'invoice')).toBe(1);
  });
});

describe('resolvePackagePrice', () => {
  const packages = [{ name: 'NET.SI 50 Mbps', price: 300000 }];

  it('matches the price by exact package name', () => {
    expect(resolvePackagePrice('NET.SI 50 Mbps', packages)).toBe(300000);
  });

  it('falls back to the default price for an unrecognized package', () => {
    expect(resolvePackagePrice('Paket Aneh', packages)).toBe(300000);
    expect(resolvePackagePrice('Paket Aneh', packages, 500000)).toBe(500000);
  });
});

describe('formatNumber', () => {
  it('formats with Indonesian thousand separators', () => {
    expect(formatNumber(300000)).toBe('300.000');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(null)).toBe('0');
  });
});

describe('formatDateIndo', () => {
  it('formats yyyy-mm-dd as a full Indonesian date', () => {
    expect(formatDateIndo('2026-09-09')).toBe('9 September 2026');
  });

  it('passes through an empty value', () => {
    expect(formatDateIndo('')).toBe('');
  });
});

describe('formatDateIndoShort', () => {
  it('formats yyyy-mm-dd as a short Indonesian date', () => {
    expect(formatDateIndoShort('2026-09-09')).toBe('09 Sep 2026');
  });
});
