import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, searchInvoice, isRunsnetConfigured } from '../_lib/runsnetClient.js';
import { buildInvoiceLookupLog } from '../../src/utils/runsnetSync.js';

// Dipanggil dari Transaksi.jsx SAAT transaksi baru dibuat (sebelum disimpan), supaya nomor invoice
// yang dipakai KAsir sama dengan nomor invoice asli di Runsnet. HANYA membaca (mencari), tidak
// pernah membayar. Dibuka untuk semua staf yang login (kasir/admin biasa termasuk), bukan
// superadmin-only, karena ini cuma pencarian, bukan aksi sensitif.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error, adminClient } = await verifyStaff(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const { query, localId, transactionId } = req.body || {};
  const refId = localId || transactionId;
  if (!query || !refId) {
    res.status(400).json({ error: 'query dan localId/transactionId wajib diisi.' });
    return;
  }

  const configured = isRunsnetConfigured();
  let invoice = null;
  let lookupError = null;

  if (configured) {
    try {
      const session = await getRunsnetSession(adminClient);
      // Pertama cari tagihan yang PENDING ('P')
      invoice = await searchInvoice(session, query, 'P');
      // Jika tidak ada di PENDING, cari apakah invoice sudah tercatat PAID ('A') di Runsnet
      if (!invoice) {
        invoice = await searchInvoice(session, query, 'A');
      }
    } catch (err) {
      lookupError = err.message;
    }
  }

  // Jika transactionId disertakan dan nomor invoice Runsnet ditemukan, update langsung ke tabel transactions
  const targetId = transactionId || (localId && !localId.startsWith('INV-') ? localId : null);
  if (targetId && invoice?.id) {
    try {
      await adminClient.from('transactions').update({ invoice_number: String(invoice.id) }).eq('id', targetId);
    } catch (dbErr) {
      console.warn('DB update invoice_number note:', dbErr);
    }
  }

  const logEntry = lookupError
    ? { status: 'failed', runsnet_ref: null, message: `Gagal mencari invoice Runsnet: ${lookupError}` }
    : buildInvoiceLookupLog({ configured, invoice, query });

  await adminClient.from('runsnet_sync_log').upsert(
    { transaction_id: refId, stage: 'invoice_lookup', search_query: query, customer_name: invoice?.custName || null, created_at: new Date().toISOString(), ...logEntry },
    { onConflict: 'transaction_id,stage' },
  );

  res.status(200).json({ invoice, configured, error: lookupError });
}
