import process from 'node:process';
import { parseInvoiceListResponse, stripHtml, describePayResponse, parsePaymentRows } from '../../src/utils/runsnetSync.js';
import { parsePelangganRow } from '../../src/utils/runsnetCustomers.js';

// Dibaca lewat fungsi (bukan konstanta top-level) supaya skrip lokal yang memuat .env.local
// setelah statement import tetap melihat nilainya.
const getBaseUrl = () => process.env.RUNSNET_BASE_URL || 'https://app.runsnet.id';

// ==========================================================================
// Runsnet tidak punya API resmi: semua navigasi lewat satu file `view/index.php` dengan satu
// parameter GET "kunci menu" yang NAMA dan NILAINYA obfuskasi (base64 di atas sesuatu yang
// terenkripsi) DAN BERUBAH — terbukti 2026-09-22: kunci yang terverifikasi jalan sehari sebelumnya
// sudah tidak berlaku esoknya (menuju ke halaman lain, bukan error). Jadi TIDAK ADA yang dihardcode
// di sini lagi. Sebagai gantinya, discoverMenuMap() membaca kunci yang BERLAKU SAAT INI langsung dari
// menu resmi Runsnet sendiri (persis seperti membuka menunya di browser) tiap kali sesi login dibuat,
// lalu disimpan bersama cookie-nya (lihat getRunsnetSession) supaya tidak perlu ditemukan ulang tiap
// pemanggilan.
//
// Yang TETAP (bukan kunci menu, terbukti stabil karena berupa path/ID biasa, bukan token obfuskasi):
const SEARCH_PATH = 'model/previewc/query/invoice.php';
const PAYMENT_LIST_PATH = 'model/previewc/query/payment.php';
const CUSTOMERS_PATH = 'model/previewc/query/pelanggan.php';
const MITRA_TARGET = 'ID00000000024';

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

export function isRunsnetConfigured() {
  return Boolean(process.env.RUNSNET_USERNAME && process.env.RUNSNET_PASSWORD);
}

// Uji koneksi: hanya mencoba login, tidak menyentuh menu/pembayaran. Dipakai tombol "Uji Koneksi" di Pengaturan.
export async function pingRunsnet() {
  try {
    await loginToRunsnet();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

// Label -> nilai kunci menu yang WAJIB ditemukan supaya fitur sinkron bisa jalan. Nama label persis
// seperti teks <span> di menu Runsnet sendiri (previewc/FTTH -> GROUP 3 "Invoice", "Payment"; GROUP 2
// "Pelanggan").
const REQUIRED_MENU_LABELS = ['Invoice', 'Payment', 'Pelanggan'];

// Membaca kunci-kunci menu yang BERLAKU SAAT INI lewat menu resmi Runsnet sendiri:
// 1. Submenu FTTH (previewc) -> daftar link <a href="?<kunciMenu>=<nilai>"><span>Label</span></a>,
//    dari situ didapat nama parameter kunci menu + nilai utk Invoice/Payment/Pelanggan.
// 2. Buka halaman Invoice pakai nilainya -> baca teks fungsi createpayment() utk nilai eksekusi bayar.
// 3. Buka halaman Payment pakai nilainya -> baca teks fungsi createreversal() utk nilai eksekusi reversal.
// Semua langkah ini GET/POST biasa (hanya membaca), sama seperti membuka menu itu sendiri di browser.
export async function discoverMenuMap(cookie) {
  const subRes = await fetch(`${getBaseUrl()}/view/control/function/function_get_menu.php?menu=previewc_invoice&master=previewc&level=LVL06`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest', Cookie: cookie },
  });
  const subHtml = await subRes.text();

  let menuKeyParam = null;
  const byLabel = {};
  const linkRe = /href="\?([A-Za-z0-9+/=]+)=([A-Za-z0-9+/=]+)"[^>]*>[\s\S]{0,60}?<span>([^<]+)<\/span>/g;
  let m;
  while ((m = linkRe.exec(subHtml)) !== null) {
    menuKeyParam = m[1];
    byLabel[m[3].trim()] = m[2];
  }

  const missingLabels = REQUIRED_MENU_LABELS.filter((label) => !byLabel[label]);
  if (!menuKeyParam || missingLabels.length > 0) {
    throw new Error(`Tidak menemukan menu Runsnet (${missingLabels.join(', ') || 'kunci menu'}). Struktur menu Runsnet mungkin berubah.`);
  }

  const fetchMenuPage = async (value) => {
    const url = new URL(`${getBaseUrl()}/view/index.php`);
    url.searchParams.set(menuKeyParam, value);
    const response = await fetch(url, { headers: { Cookie: cookie } });
    return response.text();
  };

  // Nilai eksekusi (createpayment/createreversal) ditemukan dari isi fungsi JS itu di halaman terkait —
  // bentuknya persis window.open('?<kunciMenu>=<nilai>&data1=' + ..., '_self').
  const extractActionValue = (html, fnName, keyParam) => {
    const i = html.indexOf(`function ${fnName}(`);
    if (i < 0) return null;
    const re = new RegExp(`window\\.open\\('\\?${keyParam}=([A-Za-z0-9+/=]+)&`);
    const found = html.slice(i, i + 800).match(re);
    return found ? found[1] : null;
  };

  const invoiceHtml = await fetchMenuPage(byLabel.Invoice);
  const paymentActionValue = extractActionValue(invoiceHtml, 'createpayment', menuKeyParam);

  const paymentHtml = await fetchMenuPage(byLabel.Payment);
  const reversalActionValue = extractActionValue(paymentHtml, 'createreversal', menuKeyParam);

  if (!paymentActionValue || !reversalActionValue) {
    throw new Error('Tidak menemukan tombol Bayar/Reversal di halaman Runsnet. Struktur halaman Runsnet mungkin berubah.');
  }

  return {
    menuKeyParam,
    invoiceListMenuValue: byLabel.Invoice,
    paymentPageMenuValue: byLabel.Payment,
    customersMenuValue: byLabel.Pelanggan,
    paymentMenuValue: paymentActionValue,
    reversalMenuValue: reversalActionValue,
  };
}

// true kalau cookie+menu (sesi tersimpan) masih benar-benar diterima Runsnet HARI INI: memuat daftar
// invoice pakai kunci itu betul-betul menampilkan daftar invoice (dicek lewat penanda 'InvoiceCode' di
// isinya), bukan cuma HTTP 200 (halaman lain pun bisa 200). Ini menangkap DUA jenis basi sekaligus:
// cookie yang sudah tidak valid, ATAU kunci menu yang sudah berganti sejak terakhir disimpan.
async function isMenuMapStillValid(cookie, menu) {
  if (!menu?.menuKeyParam || !menu?.invoiceListMenuValue) return false;
  const url = new URL(`${getBaseUrl()}/view/index.php`);
  url.searchParams.set(menu.menuKeyParam, menu.invoiceListMenuValue);
  const response = await fetch(url, { method: 'GET', headers: { Cookie: cookie }, redirect: 'manual' });
  if (response.status !== 200) return false;
  const html = await response.text();
  return html.includes('InvoiceCode');
}

// Titik masuk utama: cookie login + kunci menu yang TERBUKTI berlaku saat ini, dari cache (tabel
// runsnet_session) kalau masih segar (< 1 jam DAN masih valid dites nyata), kalau tidak login +
// temukan ulang. Menggantikan ensureSession/ensureValidSession lama (kunci menu dulu dikira tetap,
// sekarang ditemukan ulang bersama sesi karena terbukti berubah — lihat komentar di atas).
export async function getRunsnetSession(supabaseAdmin, { force = false } = {}) {
  const { data } = await supabaseAdmin.from('runsnet_session').select('cookie, menu_map, updated_at').eq('id', 1).maybeSingle();
  const ageMs = data?.updated_at ? Date.now() - new Date(data.updated_at).getTime() : Infinity;
  const ONE_HOUR = 60 * 60 * 1000;

  if (!force && data?.cookie && data?.menu_map && ageMs < ONE_HOUR && (await isMenuMapStillValid(data.cookie, data.menu_map))) {
    return { cookie: data.cookie, menu: data.menu_map };
  }

  const cookie = await loginToRunsnet();
  const menu = await discoverMenuMap(cookie);
  await supabaseAdmin.from('runsnet_session').upsert({ id: 1, cookie, menu_map: menu, updated_at: new Date().toISOString() });
  return { cookie, menu };
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
async function postInvoiceSearch({ cookie, menu }, { status, search = '', length = 10, from, to }) {
  const now = new Date();
  const dateFrom = formatMmDdYyyy(from || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
  const dateTo = formatMmDdYyyy(to || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90));

  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(menu.menuKeyParam, menu.invoiceListMenuValue);

  const searchUrl = new URL(`${getBaseUrl()}/view/${SEARCH_PATH}`);
  searchUrl.searchParams.set('data1', dateFrom);
  searchUrl.searchParams.set('data2', dateTo);
  searchUrl.searchParams.set('data3', status);
  searchUrl.searchParams.set('data4', '');
  searchUrl.searchParams.set('data5', '');
  searchUrl.searchParams.set('target', MITRA_TARGET);

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
export async function searchInvoice(session, query, status = 'P') {
  const json = await postInvoiceSearch(session, { status, search: query, length: 10 });
  return parseInvoiceListResponse(json);
}

const STATUS_LABELS = { A: 'PAID', P: 'PENDING', C: 'CANCEL' };

// Status NYATA di Runsnet untuk sekumpulan kode invoice: { KODE: 'PAID' | 'PENDING' | 'CANCEL' | 'NOT_FOUND' }.
// Mengambil daftar invoice per status untuk rentang tanggal sekitar sekarang (3 bulan ke belakang, 3 bulan ke
// depan), lalu kode yang tidak ada di daftar dicari satu-satu di rentang lebar (maks. 10 kode).
export async function fetchInvoiceStatuses(session, codes) {
  const wanted = [...new Set(codes.filter(Boolean))];
  const result = {};
  if (wanted.length === 0) return result;

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  const wantedSet = new Set(wanted);

  for (const [statusCode, label] of Object.entries(STATUS_LABELS)) {
    const json = await postInvoiceSearch(session, { status: statusCode, length: 1000, from, to });
    (json?.data || []).forEach((row) => {
      const code = stripHtml(row[1]);
      if (wantedSet.has(code)) result[code] = label;
    });
  }

  const missing = wanted.filter((code) => !result[code]);
  for (const code of missing.slice(0, 10)) {
    for (const [statusCode, label] of Object.entries(STATUS_LABELS)) {
      const found = parseInvoiceListResponse(await postInvoiceSearch(session, { status: statusCode, search: code, length: 10 }));
      if (found?.id === code) { result[code] = label; break; }
    }
  }
  wanted.forEach((code) => { if (!result[code]) result[code] = 'NOT_FOUND'; });
  return result;
}

// Bukti pembayaran: true kalau Runsnet sendiri menunjukkan invoice ini berstatus PAID (pencarian status 'A'
// dengan kode invoice sebagai kata kunci; kode invoice unik, jadi harus tepat satu hasil).
export async function verifyInvoicePaid(session, invoiceCode) {
  const found = await searchInvoice(session, invoiceCode, 'A');
  return found?.id === invoiceCode;
}

// Daftar pembayaran milik satu invoice, dibaca dari halaman Payment Runsnet (hanya membaca):
// [{ paymentCode, amount, payDate }]. Dipakai reversal untuk menemukan kode pembayaran (PAY...) dari kode invoice.
export async function findPaymentsForInvoice({ cookie, menu }, invoiceCode) {
  const now = new Date();
  const pageUrl = new URL(`${getBaseUrl()}/view/index.php`);
  pageUrl.searchParams.set(menu.menuKeyParam, menu.paymentPageMenuValue);

  const url = new URL(`${getBaseUrl()}/view/${PAYMENT_LIST_PATH}`);
  url.searchParams.set('data1', formatMmDdYyyy(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())));
  url.searchParams.set('data2', formatMmDdYyyy(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)));
  url.searchParams.set('data4', '');
  url.searchParams.set('target', MITRA_TARGET);

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
// samping nyata dan langsung — hanya dipanggil dari api/_lib/paymentReversal.js setelah semua pengaman
// (superadmin, sinkron LIVE, tepat satu pembayaran).
export async function reversePaymentByCode({ cookie, menu }, paymentCode) {
  if (!/^PAY\d+$/.test(paymentCode)) throw new Error(`Kode pembayaran tidak valid: ${paymentCode}`);

  const pageUrl = new URL(`${getBaseUrl()}/view/index.php`);
  pageUrl.searchParams.set(menu.menuKeyParam, menu.paymentPageMenuValue);

  const url = new URL(`${getBaseUrl()}/view/index.php`);
  url.searchParams.set(menu.menuKeyParam, menu.reversalMenuValue);
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

// Menjalankan pembayaran tunai untuk satu invoice. PERINGATAN: ini GET dengan efek samping nyata (langsung
// membayar) — hanya dipanggil dari alur yang sudah lolos cek saklar + anti-dobel + BUKAN mode uji coba.
export async function payInvoiceCash({ cookie, menu }, invoiceCode) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const url = new URL(`${getBaseUrl()}/view/index.php`);
  url.searchParams.set(menu.menuKeyParam, menu.paymentMenuValue);
  url.searchParams.set('data1', invoiceCode);
  url.searchParams.set('data2', 'Pembayaran Tunai');
  url.searchParams.set('data3', today);

  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(menu.menuKeyParam, menu.invoiceListMenuValue);

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
export async function fetchAllCustomers({ cookie, menu }) {
  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(menu.menuKeyParam, menu.customersMenuValue);

  const customers = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const searchUrl = new URL(`${getBaseUrl()}/view/${CUSTOMERS_PATH}`);
    searchUrl.searchParams.set('data1', '');
    searchUrl.searchParams.set('data2', '');
    searchUrl.searchParams.set('data3', '');
    searchUrl.searchParams.set('data4', '');
    searchUrl.searchParams.set('target', MITRA_TARGET);
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
