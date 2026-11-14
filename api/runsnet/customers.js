import { verifyPermission, verifyStaff } from '../_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchAllCustomers, fetchCustomerFormOptions, fetchProfilePrice } from '../_lib/runsnetClient.js';
import { buildCustomerUpsert, planAutoSync } from '../../src/utils/runsnetCustomers.js';
import { SUPPORTED_BRANCHES } from '../../src/utils/runsnetCustomerForm.js';

// Sinkron otomatis (dipanggil App tiap dibuka, semua staf): pelanggan & paket+harga ditarik dari Runsnet,
// hanya yang berubah ditulis. Digabung ke file ini (bukan endpoint baru) karena batas 12 Function Vercel Hobby.
async function autoSync(adminClient) {
  const session = await getRunsnetSession(adminClient);
  const [runsnetCustomers, { profiles }, { data: kasirCustomers, error: custErr }, { data: kasirPackages, error: pkgErr }] = await Promise.all([
    fetchAllCustomers(session),
    fetchCustomerFormOptions(session, SUPPORTED_BRANCHES[0].code),
    adminClient.from('customers').select('id, custid, name, package, status'),
    adminClient.from('packages').select('id, name, price'),
  ]);
  if (custErr || pkgErr) throw custErr || pkgErr;
  const runsnetPackages = await Promise.all(profiles.map(async (p) => ({ name: p.label, price: await fetchProfilePrice(session, p.value) })));

  const plan = planAutoSync({ runsnetCustomers, kasirCustomers, runsnetPackages, kasirPackages });
  const writes = [
    ...plan.customerUpdates.map(({ id, ...row }) => adminClient.from('customers').update(row).eq('id', id)),
    ...plan.packageUpdates.map(({ id, ...row }) => adminClient.from('packages').update(row).eq('id', id)),
    plan.customerInserts.length && adminClient.from('customers').insert(plan.customerInserts),
    plan.packageInserts.length && adminClient.from('packages').insert(plan.packageInserts),
  ].filter(Boolean);
  const failed = (await Promise.all(writes)).find((r) => r.error);
  if (failed) throw failed.error;
  return Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v.length]));
}

// Mengimpor HANYA pelanggan Runsnet yang dipilih (dicentang) superadmin — bukan seluruh daftar,
// supaya tidak ada data yang masuk tanpa sengaja. Dicocokkan ke tabel customers KAsir lewat
// custid, jadi tidak pernah dobel; hanya menambah/memperbarui, tidak pernah menghapus.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (req.body?.mode === 'auto') {
    const staff = await verifyStaff(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }
    try {
      res.status(200).json({ success: true, ...(await autoSync(staff.adminClient)) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  const { error, adminClient } = await verifyPermission(req, 'runsnet.sync_customers');
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
    const session = await getRunsnetSession(adminClient);
    const runsnetCustomers = await fetchAllCustomers(session);
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
