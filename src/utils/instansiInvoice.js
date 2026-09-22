// Logika invoice instansi (B2B): nomor dokumen, terbilang, dan periode tagihan batch.
// Format nomor & rumus terbilang meniru persis aplikasi invoicing lama (AppInvoce) supaya
// dokumen yang diterbitkan KAsir terlihat identik dengan yang sudah pernah dikirim ke klien.

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const getRomanMonth = (month) => ROMAN_MONTHS[month - 1] || '';

export const generateInvoiceNumber = (sequence, month, year, clientCode) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  return `INV-${paddedSequence}/${clientCode}/NSI/${getRomanMonth(month)}/${year}`;
};

export const generateFakturNumber = (sequence, month, year, clientCode) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  return `FKT-${paddedSequence}-${clientCode}-NSI-${getRomanMonth(month)}-${year}`;
};

// Menentukan jenis dokumen dari nomornya sendiri (dipakai preview: tampilan Faktur beda dari Invoice).
export const invoiceKindFromNumber = (invoiceNumber) => (invoiceNumber?.startsWith('FKT-') ? 'faktur' : 'invoice');

const UNITS = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

export function terbilang(n) {
  if (n < 0) return 'Minus ' + terbilang(-n);
  if (n === 0) return '';
  if (n < 12) return UNITS[n];
  if (n < 20) return (terbilang(n - 10) + ' Belas').replace(/\s+/g, ' ').trim();
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10)).replace(/\s+/g, ' ').trim();
  if (n < 200) return ('Seratus ' + terbilang(n - 100)).replace(/\s+/g, ' ').trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100)).replace(/\s+/g, ' ').trim();
  if (n < 2000) return ('Seribu ' + terbilang(n - 1000)).replace(/\s+/g, ' ').trim();
  if (n < 1000000) return (terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000)).replace(/\s+/g, ' ').trim();
  if (n < 1000000000) return (terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000)).replace(/\s+/g, ' ').trim();
  return (terbilang(Math.floor(n / 1000000000)) + ' Miliar ' + terbilang(n % 1000000000)).replace(/\s+/g, ' ').trim();
}

export const amountInWords = (amount) => (amount > 0 ? `${terbilang(amount).toUpperCase()} RUPIAH` : 'NOL RUPIAH');

const pad2 = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Tanggal terbit (awal bulan) & jatuh tempo (akhir bulan, Februari selalu tanggal 28) untuk satu
// bulan tagihan. Dipakai baik untuk invoice satu-satu maupun generator massal (Multipate).
export function billingPeriod(month, year) {
  const issued = new Date(year, month - 1, 1);
  const due = month === 2 ? new Date(year, 1, 28) : new Date(year, month, 0);
  return { issuedDate: toDateInput(issued), dueDate: toDateInput(due) };
}

// Rentang bulan (inklusif) dari startMonth..endMonth pada tahun yang sama, dipakai Multipate.
export function monthRange(startMonth, endMonth) {
  const months = [];
  for (let m = startMonth; m <= endMonth; m++) months.push(m);
  return months;
}

// Nomor urut berikutnya untuk sebuah kind ('invoice' -> INV-, 'faktur' -> FKT-), dicari dari
// urutan tertinggi yang sudah terpakai di antara invoiceNumbers yang ada (lintas klien/tahun,
// sama seperti aplikasi lama: satu sequence global per kind).
export function nextSequence(existingInvoiceNumbers, kind) {
  const pattern = kind === 'faktur' ? /FKT-(\d+)/ : /INV-(\d+)/;
  const sequences = existingInvoiceNumbers
    .map((num) => {
      const match = num.match(pattern);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((seq) => !Number.isNaN(seq));
  return (sequences.length > 0 ? Math.max(...sequences) : 0) + 1;
}

// Harga paket klien, dicocokkan dari daftar paket internet di profil perusahaan (nama harus sama
// persis). Jatuh ke harga default kalau paket tidak dikenali (klien baru / nama paket bebas).
export function resolvePackagePrice(servicePackage, internetPackages, fallback = 300000) {
  const match = (internetPackages || []).find((p) => p.name === servicePackage);
  return match ? match.price : fallback;
}

// Angka dengan pemisah ribuan gaya Indonesia (tanpa "Rp"), dipakai di kolom tabel invoice A4.
export const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(num || 0);

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const INDONESIAN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const parseDateInput = (dateStr) => {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return { year: parts[0], month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) };
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
};

// "9 September 2026" — dipakai di badan invoice (tanggal terbit, jatuh tempo).
export function formatDateIndo(dateStr) {
  const parsed = parseDateInput(dateStr);
  if (!parsed) return dateStr || '';
  return `${parsed.day} ${INDONESIAN_MONTHS[parsed.month]} ${parsed.year}`;
}

// "09 Sep 2026" — dipakai di ringkasan periode layanan (faktur).
export function formatDateIndoShort(dateStr) {
  const parsed = parseDateInput(dateStr);
  if (!parsed) return dateStr || '';
  const day = String(parsed.day).padStart(2, '0');
  return `${day} ${INDONESIAN_MONTHS_SHORT[parsed.month]} ${parsed.year}`;
}

// Ringkasan angka untuk kartu statistik di atas daftar invoice/faktur: jumlah & total nominal per
// status. amount di baris DB bertipe numeric -> bisa datang sebagai string, makanya selalu Number(...).
export function summarizeInvoices(invoices) {
  const summary = { total: invoices.length, paid: 0, pending: 0, paidAmount: 0, pendingAmount: 0 };
  invoices.forEach((inv) => {
    const amount = Number(inv.amount) || 0;
    if (inv.status === 'paid') {
      summary.paid += 1;
      summary.paidAmount += amount;
    } else {
      summary.pending += 1;
      summary.pendingAmount += amount;
    }
  });
  return summary;
}

// Filter daftar invoice/faktur untuk UI: status ('all'|'paid'|'pending'), clientId, bulan+tahun
// terbit (month 1-12, keduanya opsional/null berarti tidak difilter), dan pencarian bebas (nomor
// dokumen atau nama instansi, tidak case-sensitive). Butuh field `client` sudah ter-embed di baris
// invoice (hasil join instansi_clients) supaya bisa mencocokkan nama instansi.
export function filterInvoices(invoices, { status = 'all', clientId = null, month = null, year = null, search = '' } = {}) {
  const needle = search.trim().toLowerCase();
  return invoices.filter((inv) => {
    if (status !== 'all' && inv.status !== status) return false;
    if (clientId && inv.client_id !== clientId) return false;
    if (month || year) {
      const d = new Date(inv.issued_date);
      if (month && d.getMonth() + 1 !== month) return false;
      if (year && d.getFullYear() !== year) return false;
    }
    if (needle) {
      const haystack = `${inv.invoice_number || ''} ${inv.client?.institution_name || ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

// Filter daftar klien: status ('all'|'active'|'inactive') dan pencarian bebas (nama instansi atau
// kode klien).
export function filterClients(clients, { status = 'all', search = '' } = {}) {
  const needle = search.trim().toLowerCase();
  return clients.filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    if (needle) {
      const haystack = `${c.institution_name || ''} ${c.client_code || ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
