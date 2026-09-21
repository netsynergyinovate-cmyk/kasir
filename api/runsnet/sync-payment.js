import { verifyStaff } from '../_lib/verifySuperadmin.js';
import { syncPayment } from '../_lib/paymentSync.js';

// Dipanggil aplikasi tepat setelah transaksi retail disimpan (dan tombol "Kirim ulang" di log Runsnet).
// Transaksinya SELALU dibaca ulang dari database — isi permintaan dari browser tidak dipercaya —
// lalu dikirim ke Runsnet dan dibuktikan lewat status PAID (lihat api/_lib/paymentSync.js).
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

  const { transactionId } = req.body || {};
  if (!transactionId) {
    res.status(400).json({ error: 'transactionId wajib diisi.' });
    return;
  }

  const { data: transaction } = await adminClient
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();
  if (!transaction) {
    res.status(404).json({ error: 'Transaksi tidak ditemukan di database.' });
    return;
  }

  const result = await syncPayment(adminClient, transaction);
  res.status(200).json(result);
}
