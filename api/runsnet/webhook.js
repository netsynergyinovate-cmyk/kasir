import process from 'node:process';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { syncPayment } from '../_lib/paymentSync.js';

// OPSIONAL. Jalur utama sinkron pembayaran sekarang api/runsnet/sync-payment.js, dipanggil aplikasi tepat
// setelah transaksi disimpan (tanpa perlu mengatur apa pun di dashboard Supabase). Endpoint ini tetap ada
// untuk Supabase Database Webhook (event INSERT tabel transactions) kalau suatu saat mau dipakai juga;
// keduanya memakai logika yang sama (api/_lib/paymentSync.js).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = req.headers['x-webhook-secret'];
  if (!process.env.RUNSNET_WEBHOOK_SECRET || secret !== process.env.RUNSNET_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Secret tidak valid.' });
    return;
  }

  const transaction = req.body?.record;
  if (!transaction?.id) {
    res.status(400).json({ error: 'Payload tidak berisi data transaksi.' });
    return;
  }

  const result = await syncPayment(getServiceClient(), transaction);
  res.status(200).json(result);
}
