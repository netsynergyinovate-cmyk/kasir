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

  let { data: transaction } = await adminClient.from('transactions').select('*').eq('id', transactionId).maybeSingle();
  if (!transaction) {
    // Transaksi sudah terhapus dari KAsir (mis. dihapus tanpa reversal): pulihkan dari catatan pengiriman yang
    // terbukti PAID di log Runsnet, supaya pembayaran yatim di Runsnet masih bisa dibatalkan dari panel Runsnet.
    const { data: paymentLog } = await adminClient
      .from('runsnet_sync_log')
      .select('runsnet_ref, status')
      .eq('transaction_id', transactionId)
      .eq('stage', 'payment')
      .maybeSingle();
    if (paymentLog?.status !== 'success' || !paymentLog.runsnet_ref) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan dan tidak ada catatan pembayaran Runsnet yang terbukti untuknya.' });
      return;
    }
    transaction = { id: transactionId, invoice_number: paymentLog.runsnet_ref, customer_name: null };
  }

  res.status(200).json(await reversePayment(adminClient, transaction));
}
