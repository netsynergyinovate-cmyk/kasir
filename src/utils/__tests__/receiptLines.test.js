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
    buildReceiptLines(trx(), company).forEach((l) => expect(l.text.length).toBeLessThanOrEqual(RECEIPT_WIDTH));
  });

  it('centers the header block: company name, address, WA and the receipt title', () => {
    const lines = buildReceiptLines(trx(), company);
    const centered = texts(lines.filter((l) => l.align === 'center'));
    expect(centered).toContain('PT NET SYNERGY INOVATE');
    expect(centered).toContain('STRUK PEMBAYARAN');
    expect(centered.some((t) => t.startsWith('WA:'))).toBe(true);
    expect(lines.find((l) => l.text === 'PT NET SYNERGY INOVATE').bold).toBe(true);
  });

  it('wraps a long company address over several centered lines', () => {
    const lines = buildReceiptLines(trx(), company);
    const nameIdx = lines.findIndex((l) => l.text === 'PT NET SYNERGY INOVATE');
    const waIdx = lines.findIndex((l) => l.text.startsWith('WA:'));
    expect(waIdx - nameIdx).toBeGreaterThan(2);
  });

  it('aligns every colon of the data rows in the same column', () => {
    const rows = buildReceiptLines(trx({ pppoeId: 'budi01' }), company).filter((l) => l.align === 'left' && /^[A-Za-z ]{1,7} : /.test(l.text));
    expect(rows.length).toBeGreaterThanOrEqual(9);
    rows.forEach((l) => expect(l.text.indexOf(':')).toBe(8));
  });

  it('shows the Runsnet invoice number and the payment status (bold) as rows', () => {
    const lines = buildReceiptLines(trx(), company);
    expect(lines.find((l) => l.text.startsWith('Invoice')).text).toMatch(/: INVRT202609000855$/);
    expect(lines.find((l) => l.text.startsWith('Status'))).toMatchObject({ bold: true });
  });

  it('right-aligns money values to the full width and makes Total bold', () => {
    const total = buildReceiptLines(trx(), company).find((l) => l.text.startsWith('Total'));
    expect(total.text).toMatch(/Rp 250\.000$/);
    expect(total.text.length).toBe(RECEIPT_WIDTH);
    expect(total.bold).toBe(true);
  });

  it('shows the method, the amount paid, and change without ever going negative', () => {
    const lines = buildReceiptLines(trx({ amountPaid: 300000 }), company);
    expect(lines.find((l) => l.text.startsWith('Metode')).text).toMatch(/: Cash$/);
    expect(lines.find((l) => l.text.startsWith('Bayar')).text).toMatch(/Rp 300\.000$/);
    expect(lines.find((l) => l.text.startsWith('Kembali')).text).toMatch(/Rp 50\.000$/);
    const short = buildReceiptLines(trx({ amountPaid: 100000 }), company);
    expect(short.find((l) => l.text.startsWith('Kembali')).text).toMatch(/Rp 0$/);
  });

  it('includes the PPPoE id only when the transaction has one', () => {
    expect(texts(buildReceiptLines(trx(), company)).some((t) => t.includes('PPPoE'))).toBe(false);
    expect(texts(buildReceiptLines(trx({ pppoeId: 'budi01' }), company)).some((t) => t.startsWith('PPPoE') && t.endsWith('budi01'))).toBe(true);
  });

  it('wraps a long customer name under the value column (hanging indent)', () => {
    const lines = buildReceiptLines(trx({ customerName: 'Muhammad Abdullah Musni Wijaya Kusuma' }), company);
    const idx = lines.findIndex((l) => l.text.startsWith('Nama'));
    expect(lines[idx + 1].text.startsWith(' '.repeat(10))).toBe(true);
    expect(lines[idx + 1].text.trim().length).toBeGreaterThan(0);
  });

  it('ends with a centered thank-you block', () => {
    const lines = buildReceiptLines(trx(), company);
    const idx = lines.findIndex((l) => l.text === 'TERIMA KASIH');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx]).toMatchObject({ align: 'center', bold: true });
  });
});
