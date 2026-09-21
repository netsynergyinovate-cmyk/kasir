import { verifyStaff } from '../_lib/verifySuperadmin.js';

const MAX_IMAGE_CHARS = 900_000; // ~650 KB gambar; klien sudah mengecilkan gambar sebelum mengirim
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// Menyimpan (atau mengganti) screenshot bukti pembayaran di Runsnet untuk satu transaksi. Ditulis lewat server
// (service_role) supaya admin kasir juga bisa mengunggah; penghapusan bukti khusus superadmin.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error, adminClient, callerId, role } = await verifyStaff(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const { transactionId, image } = req.body || {};
  if (!transactionId) {
    res.status(400).json({ error: 'transactionId wajib diisi.' });
    return;
  }

  const { data: transaction } = await adminClient.from('transactions').select('id').eq('id', transactionId).maybeSingle();
  if (!transaction) {
    res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    return;
  }

  if (image === null) {
    if (role !== 'superadmin') {
      res.status(403).json({ error: 'Hanya superadmin yang boleh menghapus bukti.' });
      return;
    }
    await adminClient.from('runsnet_proofs').delete().eq('transaction_id', transactionId);
    res.status(200).json({ deleted: true });
    return;
  }

  if (typeof image !== 'string' || image.length > MAX_IMAGE_CHARS || !IMAGE_PATTERN.test(image)) {
    res.status(400).json({ error: 'Gambar tidak valid atau terlalu besar (gunakan screenshot PNG/JPEG/WebP).' });
    return;
  }

  const { data: profile } = await adminClient.from('admin_profiles').select('full_name').eq('id', callerId).maybeSingle();
  const { error: saveError } = await adminClient.from('runsnet_proofs').upsert(
    { transaction_id: transactionId, image, uploaded_by: callerId, uploaded_by_name: profile?.full_name || null, created_at: new Date().toISOString() },
    { onConflict: 'transaction_id' },
  );
  if (saveError) {
    res.status(500).json({ error: 'Gagal menyimpan bukti: ' + saveError.message });
    return;
  }
  res.status(200).json({ saved: true });
}
