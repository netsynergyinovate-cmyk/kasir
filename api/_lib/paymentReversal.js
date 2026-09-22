import { pickPaymentTarget } from '../../src/utils/runsnetSync.js';
import { getRunsnetSession, fetchInvoiceStatuses, findPaymentsForInvoice, reversePaymentByCode, searchInvoice, isRunsnetConfigured } from './runsnetClient.js';

const STATUS_CODE = { PAID: 'A', PENDING: 'P', CANCEL: 'C' };

// Membatalkan (reversal) pembayaran sebuah transaksi di Runsnet SEBELUM transaksinya dihapus dari KAsir.
// Aturan pengaman: hanya jalan kalau sinkron LIVE (bukan mati/uji coba), invoice benar-benar PAID di Runsnet,
// dan ada TEPAT SATU pembayaran untuk invoice itu; hasil dibuktikan dengan membaca ulang statusnya (harus kembali
// PENDING). Mengembalikan { status, message, runsnet_ref } (status = nilai runsnet_sync_log.status) atau { skipped }.
// status 'success' berarti aman menghapus transaksi di KAsir: pembayarannya sudah tidak ada di Runsnet.
export async function reversePayment(supabase, transaction) {
  const target = pickPaymentTarget(transaction);
  let code = target.code;

  if (!code) {
    const { data: paymentLog } = await supabase
      .from('runsnet_sync_log')
      .select('runsnet_ref, status')
      .eq('transaction_id', transaction.id)
      .eq('stage', 'payment')
      .maybeSingle();
    if (paymentLog?.status === 'success') code = paymentLog.runsnet_ref;
  }
  if (!code) return { skipped: 'no_runsnet_invoice' };

  // Nama pelanggan: dari transaksi KAsir kalau masih ada; kalau tidak (transaksinya sudah dihapus — kasus
  // yang paling sering butuh reversal manual), diisi dari Runsnet sendiri begitu ketemu (lihat langkah 2),
  // supaya kartu log tetap punya nama, bukan cuma kode.
  let who = transaction.customer_name || transaction.instansi_name || null;
  const log = async (status, message, extra = {}) => {
    await supabase.from('runsnet_sync_log').upsert(
      { transaction_id: transaction.id, stage: 'reversal', status, search_query: code, runsnet_ref: code, customer_name: who, message: `${who || code}: ${message}`, created_at: new Date().toISOString(), ...extra },
      { onConflict: 'transaction_id,stage' },
    );
    return { status, runsnet_ref: code, message };
  };

  const { data: settings } = await supabase
    .from('company_settings')
    .select('runsnet_sync_enabled, runsnet_dry_run')
    .eq('id', 1)
    .maybeSingle();
  if (!settings?.runsnet_sync_enabled) return log('skipped_disabled', 'Sinkron Runsnet dimatikan, reversal TIDAK dijalankan di Runsnet.');
  if (!isRunsnetConfigured()) return log('skipped_not_configured', 'RUNSNET_USERNAME/RUNSNET_PASSWORD belum diisi, reversal tidak dijalankan.');
  if (settings.runsnet_dry_run) return log('dry_run', 'MODE UJI COBA: reversal TIDAK dijalankan di Runsnet.');

  try {
    const session = await getRunsnetSession(supabase);

    // 1. Status nyata di Runsnet. Nama diisi di sini juga (bukan cuma di langkah 2) supaya cabang "bukan
    // PAID, tidak perlu direversal" pun tetap dapat nama dari Runsnet kalau belum ada dari transaksi KAsir.
    const before = (await fetchInvoiceStatuses(session, [code]))[code];
    if (!who && STATUS_CODE[before]) {
      const found = await searchInvoice(session, code, STATUS_CODE[before]);
      if (found?.custName) who = found.custName;
    }
    if (before !== 'PAID') {
      return log('success', `Invoice ${code} berstatus ${before} di Runsnet (bukan PAID), tidak ada pembayaran yang perlu di-reversal.`);
    }

    // 2. Temukan kode pembayarannya — harus tepat satu.
    const payments = await findPaymentsForInvoice(session, code);
    if (payments.length !== 1) {
      return log('failed', `Langkah 1 dari 3 gagal: ditemukan ${payments.length} pembayaran untuk ${code}. Reversal otomatis hanya untuk tepat satu pembayaran — lakukan manual di menu Payment Runsnet.`);
    }
    const [payment] = payments;
    if (!who) who = payment.custName || code;

    // 3. Reversal (efek nyata), sesi+kunci menu disegarkan lagi tepat sebelumnya.
    const freshSession = await getRunsnetSession(supabase);
    let result;
    try {
      result = await reversePaymentByCode(freshSession, payment.paymentCode);
    } catch (reverseError) {
      return log('failed', `Langkah 2 dari 3 (kirim perintah reversal ${payment.paymentCode}) gagal: ${reverseError.message}`);
    }

    // 4. Bukti: invoice harus tidak PAID lagi.
    const after = (await fetchInvoiceStatuses(freshSession, [code]))[code];
    if (after === 'PAID') {
      return log('failed', `Langkah 3 dari 3 gagal: perintah reversal ${payment.paymentCode} dijawab Runsnet ${result.response}, tetapi invoice ${code} masih PAID. Periksa manual di menu Payment Runsnet.`);
    }
    return log('success', `Pembayaran ${payment.paymentCode} (${payment.amount}) untuk invoice ${code} berhasil di-reversal di Runsnet; status invoice kini ${after}.`);
  } catch (error) {
    return log('failed', `Gagal menghubungi Runsnet: ${error.message}`);
  }
}
