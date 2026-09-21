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

// Ukuran huruf: 'normal'; 'tall' = tinggi 2x, lebar tetap (ESC/POS GS ! 0x01, tetap muat 32 kolom) untuk
// nama usaha, judul, dan status; 'large' = lebar & tinggi 2x (GS ! 0x11) hanya muat separuh kolom, jadi
// teks dipotong selebar LARGE_WIDTH — khusus nominal total.
export const LARGE_WIDTH = RECEIPT_WIDTH / 2;

const line = (text, opts = {}) => ({ text, align: 'left', bold: false, size: 'normal', ...opts });
const center = (text, opts = {}) => line(text, { align: 'center', ...opts });
const large = (text) => wrapText(text, LARGE_WIDTH).map((t) => line(t, { align: 'center', bold: true, size: 'large' }));
const tall = (text) => wrapText(text, RECEIPT_WIDTH).map((t) => line(t, { align: 'center', bold: true, size: 'tall' }));

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

// Transaksi dari form baru memakai camelCase, yang dibaca ulang dari database (Riwayat) memakai snake_case.
// Diseragamkan di sini supaya struk cetak ulang dari Riwayat persis sama dengan struk saat transaksi dibuat.
function normalize(t) {
  const price = Number(t.price) || 0;
  return {
    date: t.date,
    cashierName: t.cashierName ?? t.cashier_name,
    customerName: t.customerName ?? t.customer_name,
    packageName: t.packageName ?? t.package_name,
    paymentMethod: t.paymentMethod ?? t.payment_method,
    pppoe: t.pppoeId ?? t.pppoe_id,
    status: t.status,
    price,
    paid: Number(t.amountPaid ?? t.amount_paid) || price,
    invoice: getInvoiceNumber(t),
  };
}

export function buildReceiptLines(transaction, companyInfo = {}) {
  const t = normalize(transaction);
  const dash = '-'.repeat(RECEIPT_WIDTH);
  const double = '='.repeat(RECEIPT_WIDTH);
  const out = [];

  // Kop: nama usaha besar, alamat dan kontak rata tengah.
  out.push(...tall(String(companyInfo.name || '').toUpperCase()));
  wrapText(companyInfo.address).forEach((a) => out.push(center(a)));
  if (companyInfo.phone) out.push(center(`WA: ${companyInfo.phone}`));
  out.push(line(double));
  out.push(...tall('STRUK PEMBAYARAN'));
  out.push(line(double));

  out.push(...field('Waktu', formatReceiptDate(t.date)));
  out.push(...field('Kasir', t.cashierName || 'Admin'));
  out.push(...field('Invoice', t.invoice));
  out.push(line(dash));

  out.push(...field('Nama', String(t.customerName || '').toUpperCase(), { bold: true }));
  if (t.pppoe) out.push(...field('PPPoE', t.pppoe));
  out.push(...field('Layanan', t.packageName || ''));
  out.push(line(dash));

  out.push(center('TOTAL PEMBAYARAN', { bold: true }));
  out.push(...large(formatRupiah(t.price)));
  out.push(...field('Metode', t.paymentMethod || '-'));
  out.push(...field('Bayar', formatRupiah(t.paid), { money: true }));
  out.push(...field('Kembali', formatRupiah(Math.max(0, t.paid - t.price)), { money: true }));
  out.push(line(double));

  out.push(...tall(String(t.status || '').toUpperCase()));
  out.push(line(double));

  out.push(center('TERIMA KASIH', { bold: true }));
  out.push(center('Simpan struk ini sebagai'));
  out.push(center('bukti pembayaran yang sah'));

  return out;
}
