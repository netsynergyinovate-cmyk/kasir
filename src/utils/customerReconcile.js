// Menyamakan data pelanggan LAMA (sumber 'kasir') dengan data Runsnet, sambil tetap
// mempertahankan hal yang cuma ada di KAsir (nama panggilan, dll). Dicocokkan lewat NAMA saja
// karena pelanggan lama belum punya custid — sengaja tidak menebak kalau nama ambigu/tidak cocok.
const normalizeName = (name) => String(name || '').trim().toUpperCase();

export function matchCustomersByName(oldCustomers, runsnetCustomers) {
  const byName = new Map();
  runsnetCustomers.forEach((r) => {
    const key = normalizeName(r.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r);
  });

  const matched = [];
  const unmatchedOld = [];
  const ambiguous = [];
  const claimedCustids = new Set();

  oldCustomers.forEach((old) => {
    const candidates = byName.get(normalizeName(old.name)) || [];
    if (candidates.length === 0) {
      unmatchedOld.push(old);
    } else if (candidates.length > 1) {
      ambiguous.push(old);
    } else if (claimedCustids.has(candidates[0].custid)) {
      // Runsnet-nya sudah "diambil" pelanggan lama lain dengan nama sama — jangan asal pilih.
      ambiguous.push(old);
    } else {
      claimedCustids.add(candidates[0].custid);
      matched.push({ old, runsnet: candidates[0] });
    }
  });

  return { matched, unmatchedOld, ambiguous };
}

// Payload UPDATE/INSERT untuk baris pelanggan hasil penyamaan: identitas & status dari Runsnet,
// field yang cuma ada di KAsir (nickname, phone, address, due_date, price, data rute) dipertahankan.
export function buildReconciledCustomer(old, runsnet) {
  return {
    id: runsnet.custid,
    custid: runsnet.custid,
    customer_id: runsnet.custid,
    name: runsnet.name,
    package: runsnet.package,
    status: runsnet.status,
    source: 'Runsnet',
    last_synced: new Date().toISOString(),
    nickname: old.nickname ?? null,
    phone: old.phone ?? null,
    address: old.address ?? null,
    due_date: old.due_date ?? null,
    price: old.price ?? null,
    lat: old.lat ?? null,
    lng: old.lng ?? null,
    route_order: old.route_order ?? null,
  };
}
