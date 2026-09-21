import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { ensureSession, searchInvoice, isRunsnetConfigured } from '../_lib/runsnetClient.js';
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

  const { query, localId } = req.body || {};
  if (!query || !localId) {
    res.status(400).json({ error: 'query dan localId wajib diisi.' });
    return;
  }

  const configured = isRunsnetConfigured();
  let invoice = null;
  let lookupError = null;

  if (configured) {
    try {
      const cookie = await ensureSession(adminClient);
      invoice = await searchInvoice(cookie, query);
    } catch (err) {
      lookupError = err.message;
    }
  }

  const logEntry = lookupError
    ? { status: 'failed', runsnet_ref: null, message: `Gagal mencari invoice Runsnet: ${lookupError}` }
    : buildInvoiceLookupLog({ configured, invoice, query });

  await adminClient.from('runsnet_sync_log').upsert(
    { transaction_id: localId, stage: 'invoice_lookup', search_query: query, created_at: new Date().toISOString(), ...logEntry },
    { onConflict: 'transaction_id,stage' },
  );

  res.status(200).json({ invoice, configured });
}
