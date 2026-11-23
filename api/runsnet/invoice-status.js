import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchInvoiceStatuses, isRunsnetConfigured, searchPayments, fetchAllCustomers } from '../_lib/runsnetClient.js';
import { buildStatusCheckLog } from '../../src/utils/runsnetSync.js';

// Status NYATA invoice di Runsnet (PAID / PENDING / CANCEL / NOT_FOUND) untuk daftar kode invoice — dibaca
// langsung dari Runsnet, bukan dari catatan KAsir. Hanya membaca. Dipakai halaman Riwayat dan panel log Runsnet.
// Panel log mengirim { detail: true }: ikut dikembalikan payments (pembayaran terbaru per kode invoice, dari menu
// Payment) dan customers (koneksi & status per nama pelanggan, dari menu Pelanggan), tanpa menulis log 'check'.
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
  const detail = req.body?.detail === true;
  if (codes.length === 0 && !detail) {
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

    if (detail) {
      const [paymentRows, customerRows] = await Promise.all([searchPayments(session, '', null, 300), fetchAllCustomers(session)]);
      const payments = {};
      paymentRows.forEach((p) => { if (codes.includes(p.invoiceCode) && !payments[p.invoiceCode]) payments[p.invoiceCode] = p; });
      const customers = {};
      customerRows.forEach((c) => { customers[c.name.trim().toUpperCase()] = { custid: c.custid, connection: c.connection, status: c.runsnetStatus }; });
      res.status(200).json({ statuses, payments, customers, checkedAt: new Date().toISOString() });
      return;
    }

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
