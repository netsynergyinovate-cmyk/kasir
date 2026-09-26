import { pickPaymentTarget, shouldSyncTransaction } from './runsnetSync';

// Status NYATA sebuah invoice di Runsnet, dibaca langsung dari Runsnet (api/runsnet/invoice-status.js).
// Kode invoice Runsnet sebuah transaksi (atau null kalau transaksinya hanya bernomor lokal INV-...).
export const runsnetCodeOf = (transaction) => pickPaymentTarget(transaction).code;

const STATUS_VIEW = {
  PAID: { text: 'PAID di Runsnet', tone: 'ok', className: 'bg-emerald-100 text-emerald-700' },
  PENDING: { text: 'BELUM lunas di Runsnet', tone: 'bad', className: 'bg-red-100 text-red-700' },
  CANCEL: { text: 'CANCEL di Runsnet', tone: 'bad', className: 'bg-red-100 text-red-700' },
  NOT_FOUND: { text: 'Tidak ditemukan di Runsnet', tone: 'warn', className: 'bg-amber-100 text-amber-800' },
};

// Tampilan lencana untuk satu transaksi. runsnetStatus: hasil pembacaan Runsnet (undefined = belum dibaca).
export function describeRunsnetStatus(transaction, runsnetStatus) {
  if (!runsnetCodeOf(transaction)) {
    return { key: 'local', text: 'Bukan invoice Runsnet', tone: 'muted', className: 'bg-gray-100 text-gray-500' };
  }
  if (!runsnetStatus) {
    return { key: 'checking', text: 'Mengecek Runsnet...', tone: 'muted', className: 'bg-gray-100 text-gray-500' };
  }
  const view = STATUS_VIEW[runsnetStatus] || { text: runsnetStatus, tone: 'warn', className: 'bg-amber-100 text-amber-800' };
  return { key: runsnetStatus, ...view };
}

// Catatan KAsir bilang sudah dibayar (LUNAS atau KASBON — keduanya wajib PAID di Runsnet, lihat
// shouldSyncTransaction), tetapi Runsnet belum PAID: perlu dikirim ulang / diperiksa.
export function isRunsnetMismatch(transaction, runsnetStatus) {
  return transaction.type !== 'instansi'
    && shouldSyncTransaction(transaction)
    && Boolean(runsnetCodeOf(transaction))
    && Boolean(runsnetStatus)
    && runsnetStatus !== 'PAID';
}
