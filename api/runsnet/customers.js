import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { ensureSession, fetchAllCustomers } from '../_lib/runsnetClient.js';
import { buildCustomerUpsert } from '../../src/utils/runsnetCustomers.js';

// Mengimpor HANYA pelanggan Runsnet yang dipilih (dicentang) superadmin — bukan seluruh daftar,
// supaya tidak ada data yang masuk tanpa sengaja. Dicocokkan ke tabel customers KAsir lewat
// custid, jadi tidak pernah dobel; hanya menambah/memperbarui, tidak pernah menghapus.
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

  const custids = Array.isArray(req.body?.custids) ? req.body.custids.filter(Boolean) : [];
  if (custids.length === 0) {
    res.status(400).json({ error: 'Pilih minimal satu pelanggan untuk diimpor.' });
    return;
  }

  try {
    const cookie = await ensureSession(adminClient);
    const runsnetCustomers = await fetchAllCustomers(cookie);
    const selected = new Set(custids);
    const toImport = runsnetCustomers.filter((c) => selected.has(c.custid));

    let created = 0;
    let updated = 0;

    for (const parsed of toImport) {
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

    res.status(200).json({ success: true, total: toImport.length, created, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
