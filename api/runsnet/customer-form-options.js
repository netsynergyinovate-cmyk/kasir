import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchCustomerFormOptions } from '../_lib/runsnetClient.js';

// Dropdown Cluster & Paket di form "Tambah Pelanggan" bergantung pada Cabang yang dipilih — dibaca
// live dari Runsnet (harga paket bisa berubah sewaktu-waktu di sana), bukan disimpan statis di KAsir.
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

  const { branchCode, jenis } = req.body || {};
  if (!branchCode) {
    res.status(400).json({ error: 'branchCode wajib diisi.' });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    const options = await fetchCustomerFormOptions(session, branchCode, jenis || 'pppoe');
    res.status(200).json({ success: true, ...options });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
