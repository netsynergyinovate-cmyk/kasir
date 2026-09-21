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
