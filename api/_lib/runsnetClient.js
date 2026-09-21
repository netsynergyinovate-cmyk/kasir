import process from 'node:process';
import { isConfigPlaceholder } from '../../src/utils/runsnetSync.js';

// Dibaca lewat fungsi (bukan konstanta top-level) supaya skrip lokal yang memuat .env.local
// setelah statement import tetap melihat nilainya.
const getBaseUrl = () => process.env.RUNSNET_BASE_URL || 'https://app.runsnet.id';

// ==========================================================================
// KONFIGURASI YANG WAJIB DIISI SEBELUM SINKRON BISA BENAR-BENAR MENGIRIM APA PUN.
//
// Nilainya SENGAJA diisi 'REPLACE_ME' (bukan ditebak) karena Runsnet tidak
// punya API resmi. Diisi dari hasil tangkapan DevTools (Network tab -> Copy as cURL)
// saat superadmin melakukan pencarian invoice & mass action pembayaran secara manual
// di app.runsnet.id. Sampai diisi, searchInvoice() dan payInvoiceCash() menolak
// mengirim apa pun dan mencatat status 'skipped_not_configured' di log.
//
// Cara isi: ganti 'REPLACE_ME' dengan nilai asli, lalu commit & deploy ulang.
// ==========================================================================
const CONFIG = {
  // Path (relatif ke BASE_URL) endpoint pencarian invoice, dari request yang dikirim
  // saat mengetik di kolom search halaman Main Menu > FTTH > Invoice.
  searchPath: 'REPLACE_ME',
  // Nama field POST/GET yang membawa kata kunci pencarian.
  searchQueryField: 'REPLACE_ME',
  // Nama field di hasil pencarian (JSON/HTML) yang berisi ID invoice unik untuk dipakai
  // pada langkah pembayaran.
  searchResultIdField: 'REPLACE_ME',
  // Path endpoint mass action "Buat Pembayaran".
  paymentPath: 'REPLACE_ME',
  // Nama field yang menyatakan metode pembayaran tunai (dan nilainya), dari request yang
  // terekam sampai sebelum tombol final "Bayar" ditekan.
  paymentMethodField: 'REPLACE_ME',
  paymentMethodValue: 'REPLACE_ME',
  // Nama field yang membawa ID invoice pada request pembayaran.
  paymentInvoiceIdField: 'REPLACE_ME',
};

function unconfiguredFields() {
  return Object.entries(CONFIG)
    .filter(([, value]) => isConfigPlaceholder(value))
    .map(([key]) => key);
}

export function isRunsnetConfigured() {
  return unconfiguredFields().length === 0;
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

  const body = new URLSearchParams({ username, password, panelOption: 'admin' });
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

// Mencari invoice di Runsnet. Mengembalikan { id: <id invoice> } atau null jika tidak ketemu.
export async function searchInvoice(cookie, query) {
  const fields = unconfiguredFields().filter((key) => key.startsWith('search'));
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const body = new URLSearchParams({ [CONFIG.searchQueryField]: query });
  const response = await fetch(`${getBaseUrl()}/${CONFIG.searchPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
  });
  if (!response.ok) throw new Error(`Pencarian invoice Runsnet gagal: HTTP ${response.status}`);

  const data = await response.json();
  const first = Array.isArray(data) ? data[0] : Array.isArray(data?.data) ? data.data[0] : null;
  return first ? { id: first[CONFIG.searchResultIdField] } : null;
}

// Menjalankan mass action "Buat Pembayaran > Tunai" untuk satu invoice.
export async function payInvoiceCash(cookie, invoiceId) {
  const fields = unconfiguredFields().filter((key) => key.startsWith('payment'));
  if (fields.length > 0) throw new RunsnetNotConfiguredError(fields);

  const body = new URLSearchParams({
    [CONFIG.paymentInvoiceIdField]: invoiceId,
    [CONFIG.paymentMethodField]: CONFIG.paymentMethodValue,
  });
  const response = await fetch(`${getBaseUrl()}/${CONFIG.paymentPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
  });
  if (!response.ok) throw new Error(`Pembayaran Runsnet gagal: HTTP ${response.status}`);
  return response.json();
}
