import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchInvoiceStatuses, isRunsnetConfigured } from '../_lib/runsnetClient.js';
import { buildStatusCheckLog } from '../../src/utils/runsnetSync.js';

// Status NYATA invoice di Runsnet (PAID / PENDING / CANCEL / NOT_FOUND) untuk daftar kode invoice — dibaca
// langsung dari Runsnet, bukan dari catatan KAsir. Hanya membaca. Dipakai halaman Riwayat.
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

  const codes = Array.isArray(req.body?.codes) ? req.body.codes.filter((c) => typeof c === 'string').slice(0, 80) : [];
  if (codes.length === 0) {
    res.status(200).json({ statuses: {}, checkedAt: new Date().toISOString() });
    return;
  }
  if (!isRunsnetConfigured()) {
    res.status(200).json({ error: 'Konfigurasi Runsnet belum lengkap.', statuses: {} });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    const statuses = await fetchInvoiceStatuses(session, codes);

    // Catat pengecekan ini sendiri di log Runsnet (stage 'check'), supaya alur kerja pengecekan terlihat —
    // bukan cuma hasil pembayaran/reversal. Kunci upsert `check:<kode>` per invoice: hasil TERBARU menimpa
    // yang lama, tidak menumpuk baris baru tiap kali di-refresh.
    const rows = Object.entries(statuses).map(([code, status]) => ({
      transaction_id: `check:${code}`,
      stage: 'check',
      created_at: new Date().toISOString(),
      ...buildStatusCheckLog(code, status),
    }));
    if (rows.length > 0) {
      await adminClient.from('runsnet_sync_log').upsert(rows, { onConflict: 'transaction_id,stage' });
    }

    res.status(200).json({ statuses, checkedAt: new Date().toISOString() });
  } catch (err) {
    res.status(200).json({ error: `Gagal membaca Runsnet: ${err.message}`, statuses: {} });
  }
}
