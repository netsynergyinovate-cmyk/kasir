import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchProfilePrice } from '../_lib/runsnetClient.js';

// Biaya Bulanan otomatis terisi begitu Paket (Profile) dipilih, sama seperti form Runsnet aslinya.
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

  const { profileValue } = req.body || {};
  if (!profileValue) {
    res.status(400).json({ error: 'profileValue wajib diisi.' });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    const price = await fetchProfilePrice(session, profileValue);
    res.status(200).json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
