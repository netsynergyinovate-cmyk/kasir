// Logika murni untuk sinkronisasi pembayaran KAsir -> Runsnet. Dipakai oleh Vercel Function
// (api/runsnet/webhook.js) yang tidak bisa diuji langsung (memanggil Runsnet sungguhan),
// jadi aturan keputusannya dipisah ke sini supaya bisa diuji.

// Transaksi yang layak disinkron: pembayaran yang benar-benar tercatat sukses.
// payment_method 'CS' = penyesuaian customer service, bukan uang yang benar-benar diterima.
export function shouldSyncTransaction(transaction) {
  const isSuccess = transaction.status === 'LUNAS' || transaction.type === 'instansi';
  return isSuccess && transaction.payment_method !== 'CS';
}

// Kata kunci pencarian invoice di Runsnet: PPPoE ID paling akurat (unik per pelanggan),
// lalu ID pelanggan, baru nama (bisa ganda/typo, cadangan terakhir).
export function buildSearchQuery(transaction) {
  const candidate = transaction.pppoe_id || transaction.custid || transaction.customer_name;
  const trimmed = (candidate || '').trim();
  return trimmed || null;
}

const PLACEHOLDER = 'REPLACE_ME';

// true jika nilai konfigurasi Runsnet (nama field/URL) belum diisi dengan nilai asli hasil
// tangkapan DevTools. Dipakai untuk menolak mengirim permintaan yang ditebak.
export function isConfigPlaceholder(value) {
  return !value || value === PLACEHOLDER;
}

const STATUS_TEXT = {
  success: { text: 'PAID di Runsnet (terbukti)', className: 'bg-emerald-100 text-emerald-700' },
  failed: { text: 'Gagal', className: 'bg-red-100 text-red-700' },
  dry_run: { text: 'Uji coba — TIDAK dikirim', className: 'bg-amber-100 text-amber-700' },
  skipped_disabled: { text: 'Dilewati (sinkron mati)', className: 'bg-gray-100 text-gray-500' },
  skipped_not_configured: { text: 'Dilewati (belum dikonfigurasi)', className: 'bg-gray-100 text-gray-500' },
};

// Label + warna lencana untuk satu baris log sinkronisasi, dalam bahasa yang mudah dibaca superadmin.
export function describeSyncStatus(status) {
  return STATUS_TEXT[status] || { text: status, className: 'bg-gray-100 text-gray-500' };
}

// Membuang tag HTML dari isi satu sel tabel Runsnet, mengembalikan teksnya saja.
export function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim();
}

// Mengurai respons DataTables server-side dari endpoint pencarian invoice Runsnet
// (model/previewc/query/invoice.php). Kolom ke-2 (indeks 1) berisi kode invoice.
//
// Sengaja menolak memilih kalau hasilnya lebih dari 1 (mis. dua pelanggan nama mirip) — pembayaran
// hanya boleh jalan kalau invoice-nya jelas tunggal, supaya tidak salah bayar invoice orang lain.
export function parseInvoiceListResponse(json) {
  const rows = json?.data || [];
  if (rows.length !== 1) return null;
  const invoiceCode = stripHtml(rows[0][1]);
  return invoiceCode ? { id: invoiceCode } : null;
}

// Nada warna untuk notifikasi status sinkron: hijau (berhasil), merah (gagal), abu-abu (lainnya —
// mode uji coba, dimatikan, atau belum dikonfigurasi; bukan kegagalan, jadi tidak perlu merah).
export function syncToastTone(status) {
  if (status === 'success') return 'ok';
  if (status === 'failed') return 'bad';
  return 'info';
}

const STAGE_TEXT = {
  invoice_lookup: { text: 'Cek nomor invoice', className: 'bg-indigo-100 text-indigo-700' },
  payment: { text: 'Kirim pembayaran', className: 'bg-blue-100 text-blue-700' },
};

// Label + warna lencana untuk tahap sebuah baris log: 'invoice_lookup' (dijalankan saat transaksi
// dibuat, mencari nomor invoice asli Runsnet) atau 'payment' (dijalankan setelah lunas, mengirim
// tanda bayar ke Runsnet). Baris log lama (sebelum kolom stage ada) dianggap 'payment'.
export function describeLogStage(stage) {
  return STAGE_TEXT[stage] || { text: stage, className: 'bg-gray-100 text-gray-500' };
}

// Keputusan status+pesan log untuk hasil pencarian nomor invoice (dipanggil saat transaksi baru
// dibuat, BUKAN saat pembayaran). Dipisah dari endpoint API supaya bisa diuji tanpa memanggil Runsnet.
export function buildInvoiceLookupLog({ configured, invoice, query }) {
  if (!configured) {
    return { status: 'skipped_not_configured', runsnet_ref: null, message: 'Field Runsnet belum dikonfigurasi, nomor invoice lokal dipakai.' };
  }
  if (invoice) {
    return { status: 'success', runsnet_ref: String(invoice.id), message: `Nomor invoice Runsnet ${invoice.id} ditemukan untuk "${query}" dan dipakai.` };
  }
  return { status: 'failed', runsnet_ref: null, message: `Invoice Runsnet tidak ditemukan untuk "${query}", nomor invoice lokal dipakai.` };
}

// Nomor invoice final yang dipakai transaksi: kode Runsnet kalau ketemu, kalau tidak (tidak
// ketemu / Runsnet mati / belum dikonfigurasi) pakai id lokal supaya kasir tidak pernah terhambat.
export function pickInvoiceNumber({ localId, invoice }) {
  return invoice?.id || localId;
}

// Invoice yang akan dibayar di Runsnet: kalau transaksi sudah membawa nomor invoice ASLI Runsnet (dicari saat
// transaksi dibuat, disimpan di invoice_number) pakai itu — tepat sasaran. Kalau belum (nomor lokal INV-...),
// cari lewat PPPoE ID / ID pelanggan / nama.
export function pickPaymentTarget(transaction) {
  const number = String(transaction.invoice_number || transaction.invoiceNumber || '').trim();
  const isRunsnetCode = number && number !== transaction.id && !/^INV-\d+$/.test(number);
  return { code: isRunsnetCode ? number : null, query: buildSearchQuery(transaction) };
}

// Menilai respons HTTP dari perintah bayar Runsnet. Dialihkan (302) ke login.php berarti SESI TIDAK VALID: perintah
// tidak dijalankan sama sekali, walau HTTP-nya bukan error. Hanya status "ok" yang layak dianggap terkirim.
export function describePayResponse({ status, location }) {
  const where = location ? ` → ${location}` : '';
  if (status >= 300 && status < 400 && /login\.php/i.test(location || '')) {
    return { ok: false, reason: `Sesi login Runsnet tidak valid (HTTP ${status}${where}); perintah bayar TIDAK dijalankan.` };
  }
  if (status >= 400) {
    return { ok: false, reason: `Runsnet menolak perintah bayar (HTTP ${status}${where}).` };
  }
  return { ok: true, reason: `HTTP ${status}${where}` };
}
