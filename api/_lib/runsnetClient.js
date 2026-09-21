import process from 'node:process';
import { isConfigPlaceholder } from '../../src/utils/runsnetSync.js';

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

  // Nilai menuKeyParam untuk memuat daftar invoice (dipakai mencari invoice satu pelanggan).
  // BELUM diisi — lihat catatan PENTING di searchInvoice() sebelum mengisi ini.
  invoiceListMenuValue: 'REPLACE_ME',

  // Nilai menuKeyParam untuk EKSEKUSI pembayaran. Terverifikasi dari tangkapan nyata 2026-09-21:
  // GET ke `view/index.php` dengan param ini + data1 (kode invoice, mis. "INVRT202609002184")
  // + data2 (label metode, "Pembayaran Tunai") + data3 (tanggal YYYY-MM-DD) LANGSUNG membayar
  // invoice itu — tidak ada konfirmasi/tombol terpisah di sisi server. Satu request = satu
  // pembayaran nyata; jangan pernah memanggil payInvoiceCash() di luar alur webhook yang sudah
  // dijaga saklar + mode uji coba.
  paymentMenuValue: 'Ti9XSG9WdnFyakhKS0owRzh5ZVMrZ2FpTm8wbDVWM1RLUllnTzZHN3l3dz0=',
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

// Mencari invoice di Runsnet berdasarkan query (PPPoE ID / custid / nama). Mengembalikan
// { id: <kode invoice> } atau null jika tidak ketemu.
//
// BELUM DIISI. Mekanismenya belum dikonfirmasi — tabel invoice/payment Runsnet mungkin dimuat
// sekali (lewat invoiceListMenuValue) lalu difilter di browser (DataTables client-side, tanpa
// request jaringan terpisah saat mengetik di kolom pencarian), atau lewat endpoint AJAX
// terpisah. Perlu satu tangkapan DevTools lagi: request yang memuat tabel invoice/payment
// (bukan hasil ketik di kolom cari) — lihat RUNSNET_SETUP.md.
export async function searchInvoice() {
  throw new RunsnetNotConfiguredError(unconfiguredFields(['invoiceListMenuValue']));
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
