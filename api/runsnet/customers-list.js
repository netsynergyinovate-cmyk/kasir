import { verifyPermission } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchAllCustomers } from '../_lib/runsnetClient.js';

// Daftar pelanggan Runsnet untuk dipilih superadmin (panel "Pilih dari Runsnet" di menu
// Pelanggan). HANYA membaca — tidak pernah menulis apa pun ke KAsir maupun Runsnet.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error, adminClient } = await verifyPermission(req, 'runsnet.sync_customers');
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    const customers = await fetchAllCustomers(session);
    res.status(200).json({ customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
