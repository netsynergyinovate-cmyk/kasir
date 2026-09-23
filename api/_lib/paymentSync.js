import { shouldSyncTransaction, pickPaymentTarget } from '../../src/utils/runsnetSync.js';
import { getRunsnetSession, searchInvoice, payInvoiceCash, verifyInvoicePaid, isRunsnetConfigured } from './runsnetClient.js';

// Mengirim pembayaran satu transaksi KAsir ke Runsnet dan MEMBUKTIKAN hasilnya: status 'success' di log
// hanya dicatat kalau Runsnet sendiri menunjukkan invoice itu berstatus PAID setelah dibayar. Dipanggil
// dari api/runsnet/sync-payment.js (dipicu aplikasi tepat setelah transaksi disimpan) dan webhook.js.
// Mengembalikan { status, message, runsnet_ref } (status = nilai kolom runsnet_sync_log.status), atau
// { skipped } kalau memang tidak perlu diproses.
export async function syncPayment(supabase, transaction) {
  // Nama pelanggan disimpan di baris log-nya sendiri (bukan cuma diandalkan dari tabel transactions)
  // supaya tetap tampil di kartu log walau transaksinya belakangan dihapus dari KAsir.
  const log = async (status, extra = {}) => {
    await supabase.from('runsnet_sync_log').upsert(
      {
        transaction_id: transaction.id,
        stage: 'payment',
        status,
        customer_name: transaction.customer_name || transaction.instansi_name || null,
        created_at: new Date().toISOString(),
        ...extra,
      },
      { onConflict: 'transaction_id,stage' },
    );
    return { status, runsnet_ref: extra.runsnet_ref ?? null, message: extra.message ?? null };
  };

  if (!shouldSyncTransaction(transaction)) return { skipped: 'not_payable' };

  // Sudah terbukti PAID sebelumnya: jangan diulang. Percobaan yang gagal/dilewati/uji coba boleh diulang.
  const { data: existing } = await supabase
    .from('runsnet_sync_log')
    .select('status')
    .eq('transaction_id', transaction.id)
    .eq('stage', 'payment')
    .maybeSingle();
  if (existing?.status === 'success') return { skipped: 'already_synced', status: 'success' };

  const target = pickPaymentTarget(transaction);
  const label = target.code || target.query;

  const { data: settings } = await supabase
    .from('company_settings')
    .select('runsnet_sync_enabled, runsnet_dry_run')
    .eq('id', 1)
    .maybeSingle();

  if (!settings?.runsnet_sync_enabled) {
    return log('skipped_disabled', { search_query: label, message: 'Sinkron Runsnet dimatikan di Pengaturan, tidak ada yang dikirim.' });
  }
  if (!isRunsnetConfigured()) {
    return log('skipped_not_configured', { search_query: label, message: 'RUNSNET_USERNAME/RUNSNET_PASSWORD belum diisi di Environment Variables.' });
  }
  if (!label) {
    return log('failed', { message: 'Transaksi tidak punya nomor invoice Runsnet / PPPoE ID / ID pelanggan / nama untuk dicari.' });
  }
  if (settings.runsnet_dry_run) {
    return log('dry_run', { search_query: label, message: 'MODE UJI COBA: pembayaran TIDAK dikirim ke Runsnet. Matikan mode uji coba untuk kirim sungguhan.' });
  }

  try {
    const session = await getRunsnetSession(supabase);

    // 1. Tentukan invoice PENDING yang akan dibayar.
    let invoice;
    if (target.code) {
      if (await verifyInvoicePaid(session, target.code)) {
        try {
          await supabase.from('transactions').update({ invoice_number: String(target.code) }).eq('id', transaction.id);
        } catch {}
        return log('success', { search_query: label, runsnet_ref: target.code, message: `Invoice ${target.code} sudah berstatus PAID di Runsnet (terverifikasi), tidak dibayar ulang.` });
      }
      invoice = await searchInvoice(session, target.code, 'P');
      if (!invoice || invoice.id !== target.code) {
        return log('failed', { search_query: label, message: `Invoice ${target.code} tidak berstatus PENDING maupun PAID di Runsnet (mungkin CANCEL). Periksa manual.` });
      }
    } else {
      invoice = await searchInvoice(session, target.query, 'P');
      if (!invoice) {
        return log('failed', { search_query: label, message: `Tidak ada satu pun invoice PENDING yang cocok dengan "${target.query}" di Runsnet (nol atau lebih dari satu hasil).` });
      }
    }

    // 2. Bayar (efek nyata di Runsnet), lalu 3. buktikan lewat status PAID. Sesi+kunci menu disegarkan lagi
    // tepat sebelum bayar (murah kalau masih valid, login+temukan ulang kalau sudah basi sejak langkah 1).
    const freshSession = await getRunsnetSession(supabase);
    let payResult;
    try {
      payResult = await payInvoiceCash(freshSession, invoice.id);
    } catch (payError) {
      return log('failed', {
        search_query: label,
        runsnet_ref: String(invoice.id),
        message: `Langkah 2 dari 3 (kirim perintah bayar) gagal: ${payError.message}`,
      });
    }
    const paid = await verifyInvoicePaid(freshSession, invoice.id);
    if (!paid) {
      return log('failed', {
        search_query: label,
        runsnet_ref: String(invoice.id),
        message: `Langkah 3 dari 3 (cek status PAID) gagal: perintah bayar untuk ${invoice.id} dijawab Runsnet ${payResult.response}, tetapi invoice belum berstatus PAID. Periksa manual di Runsnet sebelum mengirim ulang.`,
      });
    }

    // Simpan nomor invoice resmi Runsnet ke tabel transactions
    if (invoice?.id) {
      try {
        await supabase.from('transactions').update({ invoice_number: String(invoice.id) }).eq('id', transaction.id);
      } catch {}
    }

    return log('success', { search_query: label, runsnet_ref: String(invoice.id), message: `Invoice ${invoice.id} terbukti berstatus PAID di Runsnet.` });
  } catch (error) {
    return log('failed', { search_query: label, message: `Gagal menghubungi Runsnet: ${error.message}` });
  }
}
