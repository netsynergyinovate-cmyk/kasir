import { describe, it, expect } from 'vitest';
import { digitsOnly, normalizeMoneyDigits, formatThousands, parseMoney, MAX_MONEY_DIGITS } from '../money';

describe('money helpers', () => {
  it('formats with a dot every three digits', () => {
    expect(formatThousands('50000')).toBe('50.000');
    expect(formatThousands(1250000)).toBe('1.250.000');
    expect(formatThousands('999')).toBe('999');
    expect(formatThousands('')).toBe('');
    expect(formatThousands(null)).toBe('');
  });

  it('keeps only digits and drops leading zeros', () => {
    expect(digitsOnly('Rp 1.234.567,-')).toBe('1234567');
    expect(normalizeMoneyDigits('000123')).toBe('123');
    expect(normalizeMoneyDigits('0')).toBe('0');
    expect(normalizeMoneyDigits('abc')).toBe('');
  });

  it('caps the length so the number stays in a safe range', () => {
    expect(normalizeMoneyDigits('9'.repeat(20))).toHaveLength(MAX_MONEY_DIGITS);
  });

  it('parses formatted text back to a number', () => {
    expect(parseMoney('50.000')).toBe(50000);
    expect(parseMoney('Rp 1.250.000')).toBe(1250000);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('abc')).toBe(0);
  });
});
