import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, findCustomersByName } from '../_lib/runsnetClient.js';

// Dipakai layar sukses "Tambah Pelanggan" buat menebak Customer ID pelanggan yang baru saja
// dikirim — submitNewCustomer tidak mengembalikan Customer ID sama sekali. Caller (front-end)
// yang menangani kasus 0 atau >1 hasil (nama kembar), bukan endpoint ini.
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

  const { name } = req.body || {};
  if (!name) {
    res.status(400).json({ error: 'name wajib diisi.' });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    const matches = await findCustomersByName(session, name);
    res.status(200).json({ success: true, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
