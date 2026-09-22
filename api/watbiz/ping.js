import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { sendWatbizMessage } from '../_lib/watbizClient.js';

const TEST_MESSAGE = 'Tes koneksi Watbiz dari KAsir berhasil ✅';

// Tombol "Test Ping" di Pengaturan: kirim satu pesan WA sungguhan ke nomor yang diisi admin,
// supaya bisa dipastikan token Watbiz valid dan nomor pengirim aktif (Watbiz belum menyediakan
// endpoint status/ping terpisah, jadi verifikasi paling andal adalah kirim pesan nyata). Setiap
// percobaan dicatat ke watbiz_logs supaya kelihatan di riwayat, berhasil maupun gagal.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const staff = await verifySuperadmin(req);
  if (staff.error) {
    res.status(staff.error.status).json({ error: staff.error.message });
    return;
  }

  const { token, to, senderName } = req.body || {};
  if (!token) {
    res.status(400).json({ error: 'Token Watbiz belum diisi.' });
    return;
  }
  if (!to) {
    res.status(400).json({ error: 'Nomor tujuan tes belum diisi.' });
    return;
  }

  let result;
  try {
    result = await sendWatbizMessage(token, { number: to, message: TEST_MESSAGE });
  } catch (err) {
    result = { ok: false, status: 0, body: { error: err.message } };
  }

  try {
    await staff.adminClient.from('watbiz_logs').insert({
      phone_number: to,
      message: TEST_MESSAGE,
      kind: 'test',
      status: result.ok ? 'success' : 'failed',
      response_detail: typeof result.body === 'string' ? result.body.slice(0, 500) : JSON.stringify(result.body).slice(0, 500),
      sender_name: senderName || null,
    });
  } catch (logErr) {
    console.error('Gagal mencatat watbiz_logs:', logErr.message);
  }

  res.status(200).json(result);
}
