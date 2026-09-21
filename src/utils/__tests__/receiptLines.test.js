import { describe, it, expect } from 'vitest';
import { buildReceiptLines, RECEIPT_WIDTH } from '../receiptLines';

const company = { name: 'PT Net Synergy Inovate', address: 'RT 02/RW 00, Dusun I, Pasar Sabtu, Desa Tunggal Jaya, Teras Terunjam, Mukomuko, Bengkulu', phone: '085179722146' };
const trx = (over) => ({
  id: 'INV-1', invoiceNumber: 'INVRT202609000855', date: '2026-09-21T12:57:08.000Z', cashierName: 'Super Administrator',
  status: 'LUNAS', customerName: 'Aguinus Iwan Pujianto', packageName: 'NET.SI NETWORK 15 Mbps',
  price: 250000, amountPaid: 250000, paymentMethod: 'Cash', ...over,
});
const texts = (lines) => lines.map((l) => l.text);

describe('buildReceiptLines', () => {
  it('never produces a line wider than the printer (32 columns), so preview and print wrap identically', () => {
    const lines = buildReceiptLines(trx(), company);
    lines.forEach((l) => expect(l.text.length).toBeLessThanOrEqual(RECEIPT_WIDTH));
  });

  it('wraps a long company address over several centered lines', () => {
    const lines = buildReceiptLines(trx(), company);
    const addressLines = lines.filter((l) => l.text.includes('Pasar Sabtu') || l.text.includes('Bengkulu'));
    expect(addressLines.length).toBeGreaterThanOrEqual(1);
    expect(lines.filter((l) => l.align === 'center').length).toBeGreaterThan(3);
  });

  it('prints the company name upper-cased and bold', () => {
    const lines = buildReceiptLines(trx(), company);
    expect(lines.find((l) => l.text === 'PT NET SYNERGY INOVATE')).toMatchObject({ bold: true, align: 'center' });
  });

  it('shows the Runsnet invoice number on the INV row', () => {
    const inv = buildReceiptLines(trx(), company).find((l) => l.text.startsWith('INV:'));
    expect(inv.text).toContain('INVRT202609000855');
    expect(inv.text.length).toBe(RECEIPT_WIDTH);
  });

  it('right-aligns the total row to the full width, bold', () => {
    const total = buildReceiptLines(trx(), company).find((l) => l.text.startsWith('TOTAL'));
    expect(total.text).toMatch(/Rp 250\.000$/);
    expect(total.text.length).toBe(RECEIPT_WIDTH);
    expect(total.bold).toBe(true);
  });

  it('computes change (kembali) and never shows a negative amount', () => {
    const lines = buildReceiptLines(trx({ amountPaid: 300000 }), company);
    expect(lines.find((l) => l.text.startsWith('KEMBALI:')).text).toMatch(/Rp 50\.000$/);
    const short = buildReceiptLines(trx({ amountPaid: 100000 }), company);
    expect(short.find((l) => l.text.startsWith('KEMBALI:')).text).toMatch(/Rp 0$/);
  });

  it('includes the PPPoE id only when the transaction has one', () => {
    expect(texts(buildReceiptLines(trx(), company)).some((t) => t.includes('PPPoE'))).toBe(false);
    expect(texts(buildReceiptLines(trx({ pppoeId: 'budi01' }), company)).some((t) => t.includes('ID PPPoE: budi01'))).toBe(true);
  });

  it('keeps the long date on one line by using a compact format', () => {
    const waktu = buildReceiptLines(trx(), company).find((l) => l.text.startsWith('Waktu:'));
    expect(waktu.text.length).toBe(RECEIPT_WIDTH);
  });

  it('ends with the thank-you block, centered', () => {
    const lines = buildReceiptLines(trx(), company);
    const idx = lines.findIndex((l) => l.text === 'TERIMA KASIH');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx]).toMatchObject({ bold: true, align: 'center' });
  });
});
