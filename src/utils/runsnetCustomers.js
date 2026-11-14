import { stripHtml } from './runsnetSync.js';

// Status Runsnet dipetakan ke dua nilai yang dipahami KAsir (dipakai filter pelanggan aktif
// di Dashboard/Rute). Selain "Active" dianggap nonaktif (Isolir, Terminate, Cuti, dll).
export function mapRunsnetStatus(runsnetStatus) {
  return stripHtml(runsnetStatus) === 'Active' ? 'aktif' : 'nonaktif';
}

// Kolom tabel Pelanggan Runsnet (lihat api/_lib/runsnetClient.js fetchAllCustomers):
// 0 checkbox(value=custid), 1 ikon+custid, 2 Nama, 3 Service, 4 Agent, 5 Type, 6 SPK,
// 7 Active(tanggal), 8 Expired, 9 Konektivitas, 10 Status, 11 Action.
export function parsePelangganRow(row) {
  const checkboxMatch = String(row[0] || '').match(/value=['"]([^'"]+)['"]/);
  const custid = checkboxMatch?.[1];
  if (!custid) return null;

  return {
    custid,
    name: stripHtml(row[2]),
    package: stripHtml(row[3]),
    type: stripHtml(row[5]),
    status: mapRunsnetStatus(row[10]),
  };
}

// Payload upsert ke tabel customers KAsir. Kalau pelanggan sudah ada (dicocokkan lewat custid),
// pertahankan id/phone/address/dll yang sudah ada — cuma perbarui identitas & status dari Runsnet,
// supaya data yang diisi manual di KAsir (nomor HP, alamat) tidak tertimpa kosong.
export function buildCustomerUpsert(parsed, existing) {
  return {
    id: existing?.id || parsed.custid,
    custid: parsed.custid,
    customer_id: parsed.custid,
    name: parsed.name,
    nickname: existing?.nickname ?? null,
    address: existing?.address ?? null,
    package: parsed.package,
    phone: existing?.phone ?? null,
    status: parsed.status,
    source: 'Runsnet',
    last_synced: new Date().toISOString(),
  };
}

const sameName = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

// Rencana sinkron otomatis Runsnet -> KAsir (dijalankan tiap aplikasi dibuka). Runsnet = sumber kebenaran untuk
// nama, paket, status pelanggan dan harga paket. Hanya baris yang BERUBAH yang ditulis; tidak pernah menghapus.
// Pelanggan Runsnet baru dilewati kalau namanya sama dengan pelanggan KAsir lama tanpa custid (biar tidak dobel,
// itu urusan penyamaan manual).
export function planAutoSync({ runsnetCustomers, kasirCustomers, runsnetPackages, kasirPackages }) {
  const byCustid = new Map(kasirCustomers.filter((c) => c.custid).map((c) => [c.custid, c]));
  const unlinked = kasirCustomers.filter((c) => !c.custid);

  const customerUpdates = [];
  const customerInserts = [];
  runsnetCustomers.forEach((r) => {
    const existing = byCustid.get(r.custid);
    if (existing) {
      if (existing.name !== r.name || existing.package !== r.package || existing.status !== r.status) {
        customerUpdates.push({ id: existing.id, name: r.name, package: r.package, status: r.status, last_synced: new Date().toISOString() });
      }
    } else if (!unlinked.some((c) => sameName(c.name, r.name))) {
      customerInserts.push(buildCustomerUpsert(r, null));
    }
  });

  const packageUpdates = [];
  const packageInserts = [];
  runsnetPackages.forEach((p) => {
    if (!p.name || !(p.price > 0)) return;
    const existing = kasirPackages.find((k) => sameName(k.name, p.name));
    if (!existing) packageInserts.push({ name: p.name, price: p.price });
    else if (Number(existing.price) !== p.price) packageUpdates.push({ id: existing.id, price: p.price });
  });

  return { customerUpdates, customerInserts, packageUpdates, packageInserts };
}
