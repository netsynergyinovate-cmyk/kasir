import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { reversePayment } from '../_lib/paymentReversal.js';

// Reversal pembayaran di Runsnet untuk satu transaksi, dipanggil dari Riwayat SEBELUM transaksinya dihapus.
// Khusus superadmin (sama seperti menghapus transaksi). Transaksi dibaca ulang dari database.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error, adminClient } = await verifySuperadmin(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const { transactionId } = req.body || {};
  if (!transactionId) {
    res.status(400).json({ error: 'transactionId wajib diisi.' });
    return;
  }

  const { data: transaction } = await adminClient.from('transactions').select('*').eq('id', transactionId).maybeSingle();
  if (!transaction) {
    res.status(404).json({ error: 'Transaksi tidak ditemukan di database.' });
    return;
  }

  res.status(200).json(await reversePayment(adminClient, transaction));
}
