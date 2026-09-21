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
  success: { text: 'Berhasil dikirim', className: 'bg-emerald-100 text-emerald-700' },
  failed: { text: 'Gagal', className: 'bg-red-100 text-red-700' },
  dry_run: { text: 'Mode uji coba (tidak dikirim)', className: 'bg-amber-100 text-amber-700' },
  skipped_disabled: { text: 'Dilewati (sinkron mati)', className: 'bg-gray-100 text-gray-500' },
  skipped_not_configured: { text: 'Dilewati (belum dikonfigurasi)', className: 'bg-gray-100 text-gray-500' },
};

// Label + warna lencana untuk satu baris log sinkronisasi, dalam bahasa yang mudah dibaca superadmin.
export function describeSyncStatus(status) {
  return STATUS_TEXT[status] || { text: status, className: 'bg-gray-100 text-gray-500' };
}
