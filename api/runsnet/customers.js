import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { ensureSession, fetchAllCustomers } from '../_lib/runsnetClient.js';
import { buildCustomerUpsert } from '../../src/utils/runsnetCustomers.js';

// Tombol "Sinkron Pelanggan Runsnet" di menu Pelanggan (superadmin): menarik seluruh daftar
// pelanggan dari Runsnet dan mencocokkannya ke tabel customers KAsir lewat custid — supaya nama
// & status selalu sama dengan Runsnet, tanpa membuat data dobel. Hanya menambah/memperbarui,
// tidak pernah menghapus pelanggan yang sudah ada di KAsir.
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

  try {
    const cookie = await ensureSession(adminClient);
    const runsnetCustomers = await fetchAllCustomers(cookie);

    let created = 0;
    let updated = 0;

    for (const parsed of runsnetCustomers) {
      const { data: existing } = await adminClient
        .from('customers')
        .select('id, custid, nickname, address, phone')
        .eq('custid', parsed.custid)
        .maybeSingle();

      const payload = buildCustomerUpsert(parsed, existing);
      const { error: upsertError } = await adminClient.from('customers').upsert(payload, { onConflict: 'id' });
      if (upsertError) throw upsertError;

      if (existing) updated += 1;
      else created += 1;
    }

    res.status(200).json({ success: true, total: runsnetCustomers.length, created, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
