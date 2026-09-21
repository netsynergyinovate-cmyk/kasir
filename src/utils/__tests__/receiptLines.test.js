import { describe, it, expect } from 'vitest';
import { buildReceiptLines, RECEIPT_WIDTH, LARGE_WIDTH } from '../receiptLines';

const company = { name: 'PT Net Synergy Inovate', address: 'RT 02/RW 00, Dusun I, Pasar Sabtu, Desa Tunggal Jaya, Teras Terunjam, Mukomuko, Bengkulu', phone: '085179722146' };
const trx = (over) => ({
  id: 'INV-1', invoiceNumber: 'INVRT202609000855', date: '2026-09-21T12:57:08.000Z', cashierName: 'Super Administrator',
  status: 'LUNAS', customerName: 'Aguinus Iwan Pujianto', packageName: 'NET.SI NETWORK 15 Mbps',
  price: 250000, amountPaid: 250000, paymentMethod: 'Cash', ...over,
});
const texts = (lines) => lines.map((l) => l.text);

describe('buildReceiptLines', () => {
  it('keeps normal lines within 32 columns and large (double-size) lines within 16, so preview and print wrap identically', () => {
    buildReceiptLines(trx(), company).forEach((l) => {
      expect(l.text.length).toBeLessThanOrEqual(l.size === 'large' ? LARGE_WIDTH : RECEIPT_WIDTH);
    });
  });

  it('prints the company name and the receipt title in tall (double-height) bold centered type', () => {
    const lines = buildReceiptLines(trx(), company);
    const big = lines.filter((l) => l.size === 'tall');
    expect(texts(big)).toContain('STRUK PEMBAYARAN');
    expect(texts(big)).toContain('PT NET SYNERGY INOVATE');
    big.forEach((l) => expect(l).toMatchObject({ align: 'center', bold: true }));
  });

  it('centers the address and WA lines under the company name', () => {
    const lines = buildReceiptLines(trx(), company);
    const wa = lines.find((l) => l.text.startsWith('WA:'));
    expect(wa.align).toBe('center');
    expect(lines.filter((l) => l.align === 'center' && l.size === 'normal' && l.text.includes('Bengkulu')).length).toBe(1);
  });

  it('shows the total amount in large type and the payment status in tall type, both centered', () => {
    const lines = buildReceiptLines(trx(), company);
    expect(texts(lines.filter((l) => l.size === 'large'))).toEqual(['Rp 250.000']);
    expect(texts(lines.filter((l) => l.size === 'tall'))).toContain('LUNAS');
  });

  it('aligns every colon of the data rows in the same column', () => {
    const rows = buildReceiptLines(trx({ pppoeId: 'budi01' }), company).filter((l) => l.align === 'left' && /^[A-Za-z ]{1,7} : /.test(l.text));
    expect(rows.length).toBeGreaterThanOrEqual(8);
    rows.forEach((l) => expect(l.text.indexOf(':')).toBe(8));
  });

  it('shows the Runsnet invoice number on the Invoice row', () => {
    expect(buildReceiptLines(trx(), company).find((l) => l.text.startsWith('Invoice')).text).toMatch(/: INVRT202609000855$/);
  });

  it('shows the method, the amount paid right-aligned, and change without ever going negative', () => {
    const lines = buildReceiptLines(trx({ amountPaid: 300000 }), company);
    expect(lines.find((l) => l.text.startsWith('Metode')).text).toMatch(/: Cash$/);
    const bayar = lines.find((l) => l.text.startsWith('Bayar'));
    expect(bayar.text).toMatch(/Rp 300\.000$/);
    expect(bayar.text.length).toBe(RECEIPT_WIDTH);
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

  it('produces the same receipt for a transaction read back from the database (snake_case, as opened from Riwayat)', () => {
    const fresh = trx({ amountPaid: 300000, pppoeId: 'budi01' });
    const fromDb = {
      id: 'INV-1', invoice_number: 'INVRT202609000855', date: fresh.date, cashier_name: 'Super Administrator',
      status: 'LUNAS', customer_name: 'Aguinus Iwan Pujianto', package_name: 'NET.SI NETWORK 15 Mbps',
      price: 250000, amount_paid: 300000, payment_method: 'Cash', pppoe_id: 'budi01',
    };
    expect(buildReceiptLines(fromDb, company)).toEqual(buildReceiptLines(fresh, company));
  });
});
