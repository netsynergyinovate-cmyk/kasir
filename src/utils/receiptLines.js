import { formatRupiah, getInvoiceNumber } from './format';

// Satu-satunya sumber isi struk 58mm: dipakai printer Bluetooth (ESC/POS) DAN tampilan pratinjau, supaya
// yang terlihat di layar sama persis dengan hasil cetak. Tiap baris {text, align, bold} sudah dipotong
// (word-wrap) maksimal RECEIPT_WIDTH karakter — lebar printer thermal 58mm.
export const RECEIPT_WIDTH = 32;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad2 = (n) => String(n).padStart(2, '0');

// "21 Sep 2026 19:57:08" — cukup pendek untuk muat satu baris bersama label "Waktu:".
function formatReceiptDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function wrapText(text, width = RECEIPT_WIDTH) {
  const lines = [];
  let current = '';
  String(text ?? '').split(/\s+/).filter(Boolean).forEach((word) => {
    let w = word;
    while (w.length > width) {
      if (current) { lines.push(current); current = ''; }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!current) current = w;
    else if (current.length + 1 + w.length <= width) current += ` ${w}`;
    else { lines.push(current); current = w; }
  });
  if (current) lines.push(current);
  return lines;
}

const line = (text, opts = {}) => ({ text, align: 'left', bold: false, ...opts });

// Baris "label ........ nilai" rata kiri-kanan selebar struk; kalau tidak muat, nilai turun ke baris berikutnya.
function row(label, value, opts = {}) {
  const v = String(value ?? '');
  if (label.length + 1 + v.length <= RECEIPT_WIDTH) {
    return [line(label + ' '.repeat(RECEIPT_WIDTH - label.length - v.length) + v, opts)];
  }
  return [line(label, opts), ...wrapText(v, RECEIPT_WIDTH).map((t) => line(t.padStart(RECEIPT_WIDTH), opts))];
}

export function buildReceiptLines(transaction, companyInfo = {}) {
  const t = transaction;
  const paid = t.amountPaid || t.price;
  const dash = '-'.repeat(RECEIPT_WIDTH);
  const center = (text, opts = {}) => line(text, { align: 'center', ...opts });
  const out = [];

  out.push(center(String(companyInfo.name || '').toUpperCase(), { bold: true }));
  wrapText(companyInfo.address).forEach((a) => out.push(center(a)));
  if (companyInfo.phone) out.push(center(`WA: ${companyInfo.phone}`));
  out.push(center('='.repeat(RECEIPT_WIDTH)));

  out.push(...row('Waktu:', formatReceiptDate(t.date)));
  out.push(...row('Kasir:', t.cashierName || 'Admin'));
  out.push(...row('INV:', getInvoiceNumber(t)));
  out.push(line(dash));

  out.push(center(String(t.status || '').toUpperCase(), { bold: true }));
  out.push(line(dash));

  out.push(line('PELANGGAN:'));
  wrapText(String(t.customerName || '').toUpperCase()).forEach((n) => out.push(line(n, { bold: true })));
  const pppoe = t.pppoeId || t.pppoe_id;
  if (pppoe) wrapText(`ID PPPoE: ${pppoe}`).forEach((p) => out.push(line(p, { bold: true })));
  wrapText(`LAYANAN: ${t.packageName || ''}`).forEach((p) => out.push(line(p)));
  out.push(line(dash));

  out.push(...row('TOTAL', formatRupiah(t.price), { bold: true }));
  out.push(...row('METODE:', t.paymentMethod || ''));
  out.push(...row('BAYAR:', formatRupiah(paid)));
  out.push(...row('KEMBALI:', formatRupiah(Math.max(0, paid - t.price))));
  out.push(line(dash));

  out.push(center('TERIMA KASIH', { bold: true }));
  out.push(center('Layanan internet handal & cepat'));
  out.push(center('Simpan struk ini sebagai bukti'));

  return out;
}
