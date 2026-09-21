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
const center = (text, opts = {}) => line(text, { align: 'center', ...opts });

// Tabel "Label : nilai" — label selebar LABEL_WIDTH sehingga titik dua selalu sejajar lurus. Nilai yang
// panjang dipotong ke baris berikutnya dengan menjorok sejajar nilai. money: nilai rata kanan (kolom angka).
const LABEL_WIDTH = 7;
const SEPARATOR = ' : ';
const VALUE_WIDTH = RECEIPT_WIDTH - LABEL_WIDTH - SEPARATOR.length;

function field(label, value, { bold = false, money = false } = {}) {
  const prefix = label.padEnd(LABEL_WIDTH) + SEPARATOR;
  const indent = ' '.repeat(prefix.length);
  const parts = wrapText(value ?? '', VALUE_WIDTH);
  if (parts.length === 0) parts.push('');
  return parts.map((part, i) => line((i === 0 ? prefix : indent) + (money ? part.padStart(VALUE_WIDTH) : part), { bold }));
}

export function buildReceiptLines(transaction, companyInfo = {}) {
  const t = transaction;
  const paid = t.amountPaid || t.price;
  const dash = '-'.repeat(RECEIPT_WIDTH);
  const double = '='.repeat(RECEIPT_WIDTH);
  const out = [];

  // Kop: nama usaha, alamat, dan kontak rata tengah.
  out.push(center(String(companyInfo.name || '').toUpperCase(), { bold: true }));
  wrapText(companyInfo.address).forEach((a) => out.push(center(a)));
  if (companyInfo.phone) out.push(center(`WA: ${companyInfo.phone}`));
  out.push(line(double));
  out.push(center('STRUK PEMBAYARAN', { bold: true }));
  out.push(line(double));

  out.push(...field('Waktu', formatReceiptDate(t.date)));
  out.push(...field('Kasir', t.cashierName || 'Admin'));
  out.push(...field('Invoice', getInvoiceNumber(t)));
  out.push(...field('Status', String(t.status || '').toUpperCase(), { bold: true }));
  out.push(line(dash));

  out.push(...field('Nama', String(t.customerName || '').toUpperCase(), { bold: true }));
  const pppoe = t.pppoeId || t.pppoe_id;
  if (pppoe) out.push(...field('PPPoE', pppoe));
  out.push(...field('Layanan', t.packageName || ''));
  out.push(line(dash));

  out.push(...field('Total', formatRupiah(t.price), { bold: true, money: true }));
  out.push(...field('Metode', t.paymentMethod || '-'));
  out.push(...field('Bayar', formatRupiah(paid), { money: true }));
  out.push(...field('Kembali', formatRupiah(Math.max(0, paid - t.price)), { money: true }));
  out.push(line(double));

  out.push(center('TERIMA KASIH', { bold: true }));
  out.push(center('Simpan struk ini sebagai'));
  out.push(center('bukti pembayaran yang sah'));

  return out;
}
