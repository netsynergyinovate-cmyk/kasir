import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchInvoiceStatuses, isRunsnetConfigured } from '../_lib/runsnetClient.js';

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
    res.status(200).json({ statuses, checkedAt: new Date().toISOString() });
  } catch (err) {
    res.status(200).json({ error: `Gagal membaca Runsnet: ${err.message}`, statuses: {} });
  }
}
