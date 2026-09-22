import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { sendWatbizMessage } from '../_lib/watbizClient.js';

// Tombol "Test Ping" di Pengaturan: kirim satu pesan WA sungguhan ke nomor yang diisi admin,
// supaya bisa dipastikan token Watbiz valid dan nomor pengirim aktif (Watbiz belum menyediakan
// endpoint status/ping terpisah, jadi verifikasi paling andal adalah kirim pesan nyata).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error: authError } = await verifySuperadmin(req);
  if (authError) {
    res.status(authError.status).json({ error: authError.message });
    return;
  }

  const { token, to } = req.body || {};
  if (!token) {
    res.status(400).json({ error: 'Token Watbiz belum diisi.' });
    return;
  }
  if (!to) {
    res.status(400).json({ error: 'Nomor tujuan tes belum diisi.' });
    return;
  }

  try {
    const result = await sendWatbizMessage(token, {
      to,
      text: 'Tes koneksi Watbiz dari KAsir berhasil ✅',
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
