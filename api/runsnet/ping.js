import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { pingRunsnet } from '../_lib/runsnetClient.js';

// Tombol "Uji Koneksi" di Pengaturan: hanya mencoba login ke Runsnet, tidak menyentuh field
// pencarian/pembayaran (boleh dipanggil walau field itu masih REPLACE_ME).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error } = await verifySuperadmin(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const result = await pingRunsnet();
  res.status(200).json(result);
}
