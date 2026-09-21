import process from 'node:process';
import { isConfigPlaceholder, parseInvoiceListResponse } from '../../src/utils/runsnetSync.js';
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

  const cookie = response.headers.get('set-cookie');
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
export async function ensureSession(supabaseAdmin) {
  const { data } = await supabaseAdmin.from('runsnet_session').select('cookie, updated_at').eq('id', 1).maybeSingle();

  const ageMs = data?.updated_at ? Date.now() - new Date(data.updated_at).getTime() : Infinity;
  const ONE_HOUR = 60 * 60 * 1000;
  if (data?.cookie && ageMs < ONE_HOUR) return data.cookie;

  const cookie = await loginToRunsnet();
  await supabaseAdmin.from('runsnet_session').upsert({ id: 1, cookie, updated_at: new Date().toISOString() });
  return cookie;
}

// Kolom filter tanggal endpoint pencarian (format MM/DD/YYYY, sesuai input date-range Runsnet).
// Rentang lebar (dari lama, sampai +90 hari ke depan) supaya invoice yang jatuh tempo di masa
// depan dekat (seperti pada tangkapan nyata: due date 3 hari setelah dibuat) tidak terlewat.
function formatMmDdYyyy(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()}`;
}

// Mencari invoice di Runsnet berdasarkan query (PPPoE ID / custid / nama). Mengembalikan
// { id: <kode invoice> } atau null jika tidak ketemu. Hanya mencari invoice berstatus PENDING
// (data3='P') — invoice yang sudah lunas/batal tidak relevan untuk ditandai bayar.
export async function searchInvoice(cookie, query) {
  const fields = unconfiguredFields(['menuKeyParam', 'invoiceListMenuValue', 'searchPath', 'mitraTarget']);
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const now = new Date();
  const dateFrom = formatMmDdYyyy(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
  const dateTo = formatMmDdYyyy(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90));

  const listUrl = new URL(`${getBaseUrl()}/view/index.php`);
  listUrl.searchParams.set(CONFIG.menuKeyParam, CONFIG.invoiceListMenuValue);

  const searchUrl = new URL(`${getBaseUrl()}/view/${CONFIG.searchPath}`);
  searchUrl.searchParams.set('data1', dateFrom);
  searchUrl.searchParams.set('data2', dateTo);
  searchUrl.searchParams.set('data3', 'P');
  searchUrl.searchParams.set('data4', '');
  searchUrl.searchParams.set('data5', '');
  searchUrl.searchParams.set('target', CONFIG.mitraTarget);

  // Kolom tabel sesuai urutan <thead> Runsnet: checkbox, InvoiceCode, CustID, CustNama,
  // Periode, Tempo, Tagihan, SisaTagihan, Agent, Broadcast, File, Action.
  const columnNames = ['', 'InvoiceCode', 'CustID', 'CustNama', 'Periode', 'Tempo', 'Tagihan', 'SisaTagihan', 'Agent', 'Broadcast', 'File', 'Action'];
  const body = new URLSearchParams({ draw: '1', start: '0', length: '10', 'search[value]': query, 'search[regex]': 'false' });
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

  const json = await response.json();
  return parseInvoiceListResponse(json);
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

  const response = await fetch(url, {
    method: 'GET',
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  if (response.status >= 400) throw new Error(`Pembayaran Runsnet gagal: HTTP ${response.status}`);
  return { invoiceCode, paidAt: today };
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
