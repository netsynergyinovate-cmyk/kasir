import process from 'node:process';
import { isConfigPlaceholder, parseInvoiceListResponse, stripHtml, describePayResponse, parsePaymentRows } from '../../src/utils/runsnetSync.js';
import { parsePelangganRow } from '../../src/utils/runsnetCustomers.js';

// Dibaca lewat fungsi (bukan konstanta top-level) supaya skrip lokal yang memuat .env.local
// setelah statement import tetap melihat nilainya.
const getBaseUrl = () => process.env.RUNSNET_BASE_URL || 'https://app.runsnet.id';

// ==========================================================================
// KONFIGURASI YANG WAJIB DIISI SEBELUM SINKRON BISA BENAR-BENAR MENGIRIM APA PUN.
//
// Arsitektur asli Runsnet (dikonfirmasi lewat tangkapan DevTools 2026-09-21): SEMUA navigasi
// lewat satu file `view/index.php`, dengan satu parameter GET "kunci menu" (nama tetap,
// nilainya menentukan halaman/aksi apa yang dijalankan) ditambah data1/data2/data3 untuk
// parameter aksi. Field yang masih 'REPLACE_ME' di bawah sengaja diisi begitu (bukan ditebak),
// karena Runsnet tidak punya API resmi. Sampai diisi, fungsi terkait menolak mengirim apa pun
// dan mencatat status 'skipped_not_configured' di log.
// ==========================================================================
const CONFIG = {
  // Nama parameter GET "kunci menu" — TETAP untuk semua navigasi index.php.
  // Terverifikasi dari tangkapan nyata 2026-09-21.
  menuKeyParam: 'N3lSektGNnZMV3R3ZjRlN0h0a24xZz09',

  // Nilai menuKeyParam untuk memuat daftar invoice (dipakai membentuk Referer saat mencari
  // invoice). Terverifikasi dari tangkapan nyata 2026-09-21 (sama untuk page "Invoice" dan
  // "Payment" — nilainya konsisten dipakai ulang, cuma untuk Referer, bukan untuk aksi).
  invoiceListMenuValue: 'Ti9XSG9WdnFyakhKS0owRzh5ZVMrdUVJaHVTZk1wVGY3TjVOOUtReUlScz0=',

  // Path (relatif ke view/) endpoint pencarian invoice — DataTables server-side, ditemukan
  // langsung dari kode sumber halaman (bukan tangkapan DevTools), lalu diuji nyata (2026-09-21):
  // POST dengan field standar DataTables (draw/start/length/search[value]/columns[]/order[]).
  searchPath: 'model/previewc/query/invoice.php',

  // Kode mitra/akun Runsnet ini — konstanta per akun, dipakai endpoint pencarian.
  mitraTarget: 'ID00000000024',

  // Nilai menuKeyParam untuk EKSEKUSI pembayaran. Terverifikasi dari tangkapan nyata 2026-09-21:
  // GET ke `view/index.php` dengan param ini + data1 (kode invoice, mis. "INVRT202609002184")
  // + data2 (label metode, "Pembayaran Tunai") + data3 (tanggal YYYY-MM-DD) LANGSUNG membayar
  // invoice itu — tidak ada konfirmasi/tombol terpisah di sisi server. Satu request = satu
  // pembayaran nyata; jangan pernah memanggil payInvoiceCash() di luar alur webhook yang sudah
  // dijaga saklar + mode uji coba.
  paymentMenuValue: 'Ti9XSG9WdnFyakhKS0owRzh5ZVMrZ2FpTm8wbDVWM1RLUllnTzZHN3l3dz0=',

  // Nilai menuKeyParam untuk memuat daftar pelanggan (dipakai membentuk Referer). Path endpoint
  // pencariannya berbeda dari invoice. Terverifikasi dari tangkapan nyata 2026-09-21.
  customersMenuValue: 'Z3hlVzJ5R2w5empzMXhhclAyMkRaMzJJVWFwTVFQZ1JxNlRaNDJsYTgwUT0=',
  customersPath: 'model/previewc/query/pelanggan.php',

  // Halaman menu "Payment" (daftar pembayaran + tombol Reversal). URL halamannya diberikan pengguna (2026-09-21);
  // path daftar pembayaran dan nilai menu reversal dibaca dari kode sumber halaman itu sendiri (fungsi
  // createreversal). PERINGATAN: GET dengan reversalMenuValue + data1 (kode pembayaran, mis. PAY202609000942)
  // LANGSUNG membatalkan pembayaran itu tanpa konfirmasi di server — hanya dipanggil dari alur reversal yang dijaga.
  paymentPageMenuValue: 'MnZQbDhwVXRCcXFPNEVCWHdpR3dpUy9QeEpxMHUweGFOdlRNMmdEeGFoaz0=',
  paymentListPath: 'model/previewc/query/payment.php',
  reversalMenuValue: 'MnZQbDhwVXRCcXFPNEVCWHdpR3dpWmc2VUR2aWI5dFJvemUxcSt4eGNJcz0=',
};

function unconfiguredFields(keys) {
  return keys.filter((key) => isConfigPlaceholder(CONFIG[key]));
}

export function isRunsnetConfigured() {
  return unconfiguredFields(Object.keys(CONFIG)).length === 0;
}

class RunsnetNotConfiguredError extends Error {
  constructor(fields) {
    super(`Konfigurasi Runsnet belum diisi: ${fields.join(', ')}. Lihat komentar di api/_lib/runsnetClient.js.`);
    this.name = 'RunsnetNotConfiguredError';
  }
}

async function loginToRunsnet() {
  const username = process.env.RUNSNET_USERNAME;
  const password = process.env.RUNSNET_PASSWORD;
  if (!username || !password) {
    throw new Error('RUNSNET_USERNAME / RUNSNET_PASSWORD belum di-set di Environment Variables Vercel.');
  }

  // Field asli hasil tangkapan DevTools (2026-09-21): username, password, simpan (kosong).
  // Radio "Admin/HR" di halaman login TIDAK benar-benar terkirim sebagai field terpisah.
  const body = new URLSearchParams({ username, password, simpan: '' });
  const response = await fetch(`${getBaseUrl()}/view/control/bagan_login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  });

  // Yang dikirim balik ke server hanya pasangan nama=nilai (bukan atribut path/expires dari Set-Cookie).
  const cookie = response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  if (!cookie) {
    throw new Error('Login Runsnet gagal: server tidak mengirim cookie sesi. Cek RUNSNET_USERNAME/PASSWORD.');
  }
  return cookie;
}

// Uji koneksi: hanya mencoba login, tidak menyentuh field pencarian/pembayaran (yang mungkin
// masih REPLACE_ME) dan tidak menyimpan sesi. Dipakai tombol "Uji Koneksi" di Pengaturan.
export async function pingRunsnet() {
  try {
    await loginToRunsnet();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

// Sesi login disimpan di tabel runsnet_session supaya tidak login ulang tiap transaksi
// (Vercel Function stateless antar pemanggilan; login berulang bisa memicu proteksi anti-bot).
export async function ensureSession(supabaseAdmin, { force = false } = {}) {
  const { data } = await supabaseAdmin.from('runsnet_session').select('cookie, updated_at').eq('id', 1).maybeSingle();

  const ageMs = data?.updated_at ? Date.now() - new Date(data.updated_at).getTime() : Infinity;
  const ONE_HOUR = 60 * 60 * 1000;
  if (!force && data?.cookie && ageMs < ONE_HOUR) return data.cookie;

  const cookie = await loginToRunsnet();
  await supabaseAdmin.from('runsnet_session').upsert({ id: 1, cookie, updated_at: new Date().toISOString() });
  return cookie;
}

// true kalau cookie sesi masih diterima Runsnet: memuat halaman daftar invoice tidak dialihkan ke login.php.
// Sesi bisa habis sendiri atau tergeser kalau akun yang sama login di tempat lain, jadi dicek tepat sebelum membayar.
export async function isSessionValid(cookie) {
  const url = new URL(`${getBaseUrl()}/view/index.php`);
  url.searchParams.set(CONFIG.menuKeyParam, CONFIG.invoiceListMenuValue);
  const response = await fetch(url, { method: 'GET', headers: { Cookie: cookie }, redirect: 'manual' });
  return response.status === 200;
}

// Sesi yang pasti valid: pakai sesi tersimpan kalau masih diterima Runsnet, kalau tidak login ulang.
export async function ensureValidSession(supabaseAdmin) {
  const cookie = await ensureSession(supabaseAdmin);
  if (await isSessionValid(cookie)) return cookie;
  return ensureSession(supabaseAdmin, { force: true });
}

// Kolom filter tanggal endpoint pencarian (format MM/DD/YYYY, sesuai input date-range Runsnet).
// Rentang lebar (dari lama, sampai +90 hari ke depan) supaya invoice yang jatuh tempo di masa
// depan dekat (seperti pada tangkapan nyata: due date 3 hari setelah dibuat) tidak terlewat.
function formatMmDdYyyy(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()}`;
}

// Satu permintaan pencarian ke endpoint daftar invoice Runsnet (DataTables server-side). status: kode dari filter
// halaman Runsnet sendiri — P = PENDING, A = PAID, C = CANCEL. Hanya membaca. Mengembalikan JSON mentahnya.
async function postInvoiceSearch(cookie, { status, search = '', length = 10, from, to }) {
  const fields = unconfiguredFields(['menuKeyParam', 'invoiceListMenuValue', 'searchPath', 'mitraTarget']);
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const now = new Date();
  const dateFrom = formatMmDdYyyy(from || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
  const dateTo = formatMmDdYyyy(to || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90));

  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(CONFIG.menuKeyParam, CONFIG.invoiceListMenuValue);

  const searchUrl = new URL(`${getBaseUrl()}/view/${CONFIG.searchPath}`);
  searchUrl.searchParams.set('data1', dateFrom);
  searchUrl.searchParams.set('data2', dateTo);
  searchUrl.searchParams.set('data3', status);
  searchUrl.searchParams.set('data4', '');
  searchUrl.searchParams.set('data5', '');
  searchUrl.searchParams.set('target', CONFIG.mitraTarget);

  // Kolom tabel sesuai urutan <thead> Runsnet: checkbox, InvoiceCode, CustID, CustNama,
  // Periode, Tempo, Tagihan, SisaTagihan, Agent, Broadcast, File, Action.
  const columnNames = ['', 'InvoiceCode', 'CustID', 'CustNama', 'Periode', 'Tempo', 'Tagihan', 'SisaTagihan', 'Agent', 'Broadcast', 'File', 'Action'];
  const body = new URLSearchParams({ draw: '1', start: '0', length: String(length), 'search[value]': search, 'search[regex]': 'false' });
  columnNames.forEach((name, i) => {
    body.set(`columns[${i}][data]`, String(i));
    body.set(`columns[${i}][name]`, name);
    body.set(`columns[${i}][searchable]`, i === 0 || i === 11 ? 'false' : 'true');
    body.set(`columns[${i}][orderable]`, i === 0 || i >= 9 ? 'false' : 'true');
    body.set(`columns[${i}][search][value]`, '');
    body.set(`columns[${i}][search][regex]`, 'false');
  });
  body.set('order[0][column]', '1');
  body.set('order[0][dir]', 'desc');

  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: listUrl.toString(),
      Cookie: cookie,
    },
    body,
  });
  if (!response.ok) throw new Error(`Pencarian invoice Runsnet gagal: HTTP ${response.status}`);
  return response.json();
}

// Mencari invoice di Runsnet berdasarkan query (PPPoE ID / custid / nama / kode invoice). Mengembalikan
// { id: <kode invoice> } atau null jika tidak ketemu (atau hasilnya lebih dari satu). Default hanya invoice
// PENDING ('P'); status 'A' = PAID dipakai untuk membuktikan pembayaran sudah tercatat.
export async function searchInvoice(cookie, query, status = 'P') {
  const json = await postInvoiceSearch(cookie, { status, search: query, length: 10 });
  return parseInvoiceListResponse(json);
}

const STATUS_LABELS = { A: 'PAID', P: 'PENDING', C: 'CANCEL' };

// Status NYATA di Runsnet untuk sekumpulan kode invoice: { KODE: 'PAID' | 'PENDING' | 'CANCEL' | 'NOT_FOUND' }.
// Mengambil daftar invoice per status untuk rentang tanggal sekitar sekarang (3 bulan ke belakang, 3 bulan ke
// depan), lalu kode yang tidak ada di daftar dicari satu-satu di rentang lebar (maks. 10 kode).
export async function fetchInvoiceStatuses(cookie, codes) {
  const wanted = [...new Set(codes.filter(Boolean))];
  const result = {};
  if (wanted.length === 0) return result;

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  const wantedSet = new Set(wanted);

  for (const [statusCode, label] of Object.entries(STATUS_LABELS)) {
    const json = await postInvoiceSearch(cookie, { status: statusCode, length: 1000, from, to });
    (json?.data || []).forEach((row) => {
      const code = stripHtml(row[1]);
      if (wantedSet.has(code)) result[code] = label;
    });
  }

  const missing = wanted.filter((code) => !result[code]);
  for (const code of missing.slice(0, 10)) {
    for (const [statusCode, label] of Object.entries(STATUS_LABELS)) {
      const found = parseInvoiceListResponse(await postInvoiceSearch(cookie, { status: statusCode, search: code, length: 10 }));
      if (found?.id === code) { result[code] = label; break; }
    }
  }
  wanted.forEach((code) => { if (!result[code]) result[code] = 'NOT_FOUND'; });
  return result;
}

// Bukti pembayaran: true kalau Runsnet sendiri menunjukkan invoice ini berstatus PAID (pencarian status 'A'
// dengan kode invoice sebagai kata kunci; kode invoice unik, jadi harus tepat satu hasil).
export async function verifyInvoicePaid(cookie, invoiceCode) {
  const found = await searchInvoice(cookie, invoiceCode, 'A');
  return found?.id === invoiceCode;
}

// Daftar pembayaran milik satu invoice, dibaca dari halaman Payment Runsnet (hanya membaca):
// [{ paymentCode, amount, payDate }]. Dipakai reversal untuk menemukan kode pembayaran (PAY...) dari kode invoice.
export async function findPaymentsForInvoice(cookie, invoiceCode) {
  const fields = unconfiguredFields(['menuKeyParam', 'paymentPageMenuValue', 'paymentListPath', 'mitraTarget']);
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const now = new Date();
  const pageUrl = new URL(`${getBaseUrl()}/view/index.php`);
  pageUrl.searchParams.set(CONFIG.menuKeyParam, CONFIG.paymentPageMenuValue);

  const url = new URL(`${getBaseUrl()}/view/${CONFIG.paymentListPath}`);
  url.searchParams.set('data1', formatMmDdYyyy(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())));
  url.searchParams.set('data2', formatMmDdYyyy(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)));
  url.searchParams.set('data4', '');
  url.searchParams.set('target', CONFIG.mitraTarget);

  const columnNames = ['', 'PaymentCode', 'InvoiceCode', 'CustID', 'CustNama', 'Periode', 'PayDate', 'PayAmount', 'Methode', 'Agent', 'Operator', 'Action'];
  const body = new URLSearchParams({ draw: '1', start: '0', length: '20', 'search[value]': invoiceCode, 'search[regex]': 'false' });
  columnNames.forEach((name, i) => {
    body.set(`columns[${i}][data]`, String(i));
    body.set(`columns[${i}][name]`, name);
    body.set(`columns[${i}][searchable]`, i === 0 || i === 11 ? 'false' : 'true');
    body.set(`columns[${i}][orderable]`, i === 0 || i === 6 || i >= 10 ? 'false' : 'true');
    body.set(`columns[${i}][search][value]`, '');
    body.set(`columns[${i}][search][regex]`, 'false');
  });
  body.set('order[0][column]', '1');
  body.set('order[0][dir]', 'desc');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: pageUrl.toString(),
      Cookie: cookie,
    },
    body,
  });
  if (!response.ok) throw new Error(`Membaca daftar pembayaran Runsnet gagal: HTTP ${response.status}`);
  return parsePaymentRows(await response.json(), invoiceCode);
}

// Membatalkan (reversal) SATU pembayaran Runsnet berdasarkan kode pembayarannya. PERINGATAN: GET dengan efek
// samping nyata dan langsung (lihat catatan CONFIG.reversalMenuValue) — hanya dipanggil dari
// api/_lib/paymentReversal.js setelah semua pengaman (superadmin, sinkron LIVE, tepat satu pembayaran).
export async function reversePaymentByCode(cookie, paymentCode) {
  const fields = unconfiguredFields(['menuKeyParam', 'reversalMenuValue', 'paymentPageMenuValue']);
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);
  if (!/^PAY\d+$/.test(paymentCode)) throw new Error(`Kode pembayaran tidak valid: ${paymentCode}`);

  const pageUrl = new URL(`${getBaseUrl()}/view/index.php`);
  pageUrl.searchParams.set(CONFIG.menuKeyParam, CONFIG.paymentPageMenuValue);

  const url = new URL(`${getBaseUrl()}/view/index.php`);
  url.searchParams.set(CONFIG.menuKeyParam, CONFIG.reversalMenuValue);
  url.searchParams.set('data1', paymentCode);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Cookie: cookie, Referer: pageUrl.toString() },
    redirect: 'manual',
  });
  const verdict = describePayResponse({ status: response.status, location: response.headers.get('location') });
  if (!verdict.ok) throw new Error(verdict.reason);
  return { paymentCode, response: verdict.reason };
}

// Menjalankan pembayaran tunai untuk satu invoice. PERINGATAN: ini GET dengan efek samping nyata
// (langsung membayar, lihat catatan di CONFIG.paymentMenuValue) — hanya dipanggil dari webhook
// yang sudah lolos cek saklar + anti-dobel + BUKAN mode uji coba.
export async function payInvoiceCash(cookie, invoiceCode) {
  const fields = unconfiguredFields(['menuKeyParam', 'paymentMenuValue']);
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const url = new URL(`${getBaseUrl()}/view/index.php`);
  url.searchParams.set(CONFIG.menuKeyParam, CONFIG.paymentMenuValue);
  url.searchParams.set('data1', invoiceCode);
  url.searchParams.set('data2', 'Pembayaran Tunai');
  url.searchParams.set('data3', today);

  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(CONFIG.menuKeyParam, CONFIG.invoiceListMenuValue);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Cookie: cookie, Referer: listUrl.toString() },
    redirect: 'manual',
  });
  const verdict = describePayResponse({ status: response.status, location: response.headers.get('location') });
  if (!verdict.ok) throw new Error(verdict.reason);
  return { invoiceCode, paidAt: today, response: verdict.reason };
}

// Kolom tabel Pelanggan Runsnet, sama urutan dengan <thead> aslinya.
const CUSTOMER_COLUMNS = ['', 'CustID', 'Nama', 'Service', 'Agent', 'Type', 'SPK', 'Active', 'Expired', 'Konektivitas', 'Status', 'Action'];
const CUSTOMER_PAGE_SIZE = 100;

// Mengambil SELURUH daftar pelanggan Runsnet (dipaginasi otomatis). Dipakai fitur "Sinkron
// Pelanggan Runsnet" — hanya membaca, tidak mengubah apa pun di Runsnet.
export async function fetchAllCustomers(cookie) {
  const fields = unconfiguredFields(['menuKeyParam', 'customersMenuValue', 'customersPath', 'mitraTarget']);
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(CONFIG.menuKeyParam, CONFIG.customersMenuValue);

  const customers = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const searchUrl = new URL(`${getBaseUrl()}/view/${CONFIG.customersPath}`);
    searchUrl.searchParams.set('data1', '');
    searchUrl.searchParams.set('data2', '');
    searchUrl.searchParams.set('data3', '');
    searchUrl.searchParams.set('data4', '');
    searchUrl.searchParams.set('target', CONFIG.mitraTarget);
    searchUrl.searchParams.set('data6', '');

    const body = new URLSearchParams({ draw: '1', start: String(start), length: String(CUSTOMER_PAGE_SIZE), 'search[value]': '', 'search[regex]': 'false' });
    CUSTOMER_COLUMNS.forEach((name, i) => {
      body.set(`columns[${i}][data]`, String(i));
      body.set(`columns[${i}][name]`, name);
      body.set(`columns[${i}][searchable]`, 'true');
      body.set(`columns[${i}][orderable]`, i === 0 || i === 11 ? 'false' : 'true');
      body.set(`columns[${i}][search][value]`, '');
      body.set(`columns[${i}][search][regex]`, 'false');
    });
    body.set('order[0][column]', '1');
    body.set('order[0][dir]', 'asc');

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: listUrl.toString(), Cookie: cookie },
      body,
    });
    if (!response.ok) throw new Error(`Mengambil daftar pelanggan Runsnet gagal: HTTP ${response.status}`);

    const json = await response.json();
    total = json.recordsFiltered ?? 0;
    const rows = json.data || [];
    rows.forEach((row) => {
      const parsed = parsePelangganRow(row);
      if (parsed) customers.push(parsed);
    });

    if (rows.length === 0) break; // pengaman: jangan sampai berputar tanpa henti
    start += CUSTOMER_PAGE_SIZE;
  }

  return customers;
}
