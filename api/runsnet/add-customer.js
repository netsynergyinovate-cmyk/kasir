import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, submitNewCustomer } from '../_lib/runsnetClient.js';
import { buildCustomerPayload, validateCustomerForm } from '../../src/utils/runsnetCustomerForm.js';

// Mendaftarkan pelanggan baru langsung ke Runsnet (form "Tambah Pelanggan" asli). PERINGATAN: efek
// samping nyata — begitu berhasil, baris pelanggan sungguhan langsung ada di Runsnet, tidak ada
// mode uji coba/pratinjau di sisi Runsnet-nya.
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

  const form = req.body || {};
  const validationErrors = validateCustomerForm(form);
  if (validationErrors.length > 0) {
    res.status(400).json({ error: validationErrors.join(' ') });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    const payload = buildCustomerPayload(form);
    const result = await submitNewCustomer(session, payload);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
