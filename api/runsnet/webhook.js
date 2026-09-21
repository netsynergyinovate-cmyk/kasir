import process from 'node:process';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { ensureSession, searchInvoice, payInvoiceCash, isRunsnetConfigured } from '../_lib/runsnetClient.js';
import { shouldSyncTransaction, buildSearchQuery } from '../../src/utils/runsnetSync.js';

// Dipanggil oleh Supabase Database Webhook setiap ada baris baru di tabel `transactions`
// (Database, Webhooks, event INSERT, kirim ke URL Vercel ini). Berjalan hampir seketika
// setelah kasir menyimpan transaksi, tanpa perlu cron.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = req.headers['x-webhook-secret'];
  if (!process.env.RUNSNET_WEBHOOK_SECRET || secret !== process.env.RUNSNET_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Secret tidak valid.' });
    return;
  }

  const transaction = req.body?.record;
  if (!transaction?.id) {
    res.status(400).json({ error: 'Payload tidak berisi data transaksi.' });
    return;
  }

  const supabase = getServiceClient();
  const log = async (status, extra = {}) => {
    await supabase.from('runsnet_sync_log').upsert(
      { transaction_id: transaction.id, status, created_at: new Date().toISOString(), ...extra },
      { onConflict: 'transaction_id' },
    );
  };

  // Bukan transaksi yang perlu disinkron (belum lunas, atau penyesuaian CS) — tidak dicatat sebagai error.
  if (!shouldSyncTransaction(transaction)) {
    res.status(200).json({ skipped: 'not_payable' });
    return;
  }

  // Anti-dobel: kalau transaksi ini sudah pernah diproses (sukses ATAU sudah tercatat apa pun), jangan ulang.
  // (unique constraint di tabel juga menjaga ini kalau dua panggilan datang nyaris bersamaan.)
  const { data: existing } = await supabase
    .from('runsnet_sync_log')
    .select('id, status')
    .eq('transaction_id', transaction.id)
    .maybeSingle();
  if (existing) {
    res.status(200).json({ skipped: 'already_processed', status: existing.status });
    return;
  }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('runsnet_sync_enabled, runsnet_dry_run')
    .eq('id', 1)
    .maybeSingle();

  const query = buildSearchQuery(transaction);

  if (!settings?.runsnet_sync_enabled) {
    await log('skipped_disabled', { search_query: query });
    res.status(200).json({ skipped: 'disabled' });
    return;
  }

  if (!isRunsnetConfigured()) {
    await log('skipped_not_configured', {
      search_query: query,
      message: 'Field pencarian/pembayaran Runsnet belum diisi. Lihat api/_lib/runsnetClient.js.',
    });
    res.status(200).json({ skipped: 'not_configured' });
    return;
  }

  if (!query) {
    await log('failed', { message: 'Transaksi tidak punya PPPoE ID / ID pelanggan / nama untuk dicari di Runsnet.' });
    res.status(200).json({ failed: 'no_query' });
    return;
  }

  if (settings.runsnet_dry_run) {
    await log('dry_run', { search_query: query, message: 'Mode uji coba aktif: pencarian/pembayaran TIDAK dikirim ke Runsnet.' });
    res.status(200).json({ dry_run: true, query });
    return;
  }

  try {
    const cookie = await ensureSession(supabase);
    const invoice = await searchInvoice(cookie, query);

    if (!invoice) {
      await log('failed', { search_query: query, message: `Invoice tidak ditemukan di Runsnet untuk "${query}".` });
      res.status(200).json({ failed: 'invoice_not_found' });
      return;
    }

    await payInvoiceCash(cookie, invoice.id);
    await log('success', { search_query: query, runsnet_ref: String(invoice.id) });
    res.status(200).json({ success: true, runsnet_ref: invoice.id });
  } catch (error) {
    await log('failed', { search_query: query, message: error.message });
    res.status(200).json({ failed: true, message: error.message });
  }
}
