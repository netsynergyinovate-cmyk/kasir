// Logika murni untuk fitur "Tambah Pelanggan" yang mendaftarkan pelanggan baru langsung ke form
// asli Runsnet (pac_* adalah nama field sungguhan, ditemukan lewat pembacaan langsung form Runsnet,
// bukan tebakan — lihat api/_lib/runsnetClient.js untuk pemanggilan sungguhannya).

// Nomor kontak Indonesia: 628xxxxxxxxxx (tanpa -, spasi, +), sesuai instruksi di form Runsnet sendiri.
export function sanitizePhoneForRunsnet(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (!clean.startsWith('62')) clean = '62' + clean;
  return clean;
}

// Mengubah fragmen HTML "<option value='X'>Label</option>..." (balasan pelanggan_branch.php Runsnet)
// jadi array [{value, label}]. Opsi kosong ("Pilih Cluster"/"Pilih Profile") dibuang karena bukan
// pilihan sungguhan.
export function parseOptionListHtml(html) {
  if (!html) return [];
  const matches = [...html.matchAll(/<option\s+value=['"]([^'"]*)['"]>([^<]*)<\/option>/g)];
  return matches
    .map((m) => ({ value: m[1], label: m[2].trim() }))
    .filter((opt) => opt.value !== '');
}

// Field form KAsir -> field asli form Runsnet (pac_*). branchCode dikunci ke cabang yang didukung
// (lihat SUPPORTED_BRANCHES); pac_code sengaja selalu dikosongkan supaya Runsnet generate otomatis
// (sesuai petunjuk "biarkan kosong untuk autocode" di form aslinya).
export function buildCustomerPayload(form) {
  return {
    pac_code: '',
    pac_jenis: form.jenis || 'pppoe',
    pac_nama: (form.nama || '').trim(),
    pac_user: (form.username || '').trim(),
    pac_secr: (form.secret || '').trim(),
    pac_nik: (form.nik || '').trim(),
    pac_npwp: (form.npwp || '').trim(),
    pac_kontak: sanitizePhoneForRunsnet(form.kontak),
    pac_email: (form.email || '').trim(),
    pac_kota: form.branchCode || '',
    pac_cluster: form.clusterValue || '',
    pac_alamat: (form.alamat || '').trim(),
    pac_maps: (form.titikKoordinat || '').trim(),
    pac_agent: (form.agent || '').trim(),
    pac_type: form.jenisTagihan || 'Prepaid',
    pac_service: form.profileValue || '',
    pac_biaya: String(form.biayaBulanan ?? 0),
    pac_installasi: String(form.biayaInstalasi ?? 0),
    pac_spk: form.tanggalSpk || new Date().toISOString().slice(0, 10),
    pac_expired: form.jenisTagihan === 'Postpaid' ? (form.tanggalIsolir || '20') : (form.tanggalIsolir || new Date().toISOString().slice(0, 10)),
  };
}

// Validasi per-tahap untuk wizard "Tambah Pelanggan" — dikelompokkan sesuai step di UI (lihat
// TambahPelangganRunsnet.jsx). validateCustomerForm (di bawah) DIDERIVASI dari fungsi ini (flatMap
// step 1-3), jadi keduanya otomatis tetap sinkron — tidak ada lagi daftar duplikat yang perlu dijaga
// manual.
export function validateStepFields(step, form) {
  const errors = [];
  if (step === 1) {
    if (!form.nama?.trim()) errors.push('Nama pelanggan wajib diisi.');
    if (!form.kontak?.trim()) errors.push('Nomor kontak wajib diisi.');
    if (form.nik?.trim() && form.nik.trim().length !== 16) errors.push('NIK harus 16 digit kalau diisi (cek hasil scan KTP, sering salah baca).');
  } else if (step === 2) {
    if (!form.branchCode) errors.push('Cabang (Branch) wajib dipilih.');
    if (!form.alamat?.trim()) errors.push('Alamat wajib diisi.');
  } else if (step === 3) {
    if (!form.profileValue) errors.push('Paket (Profile) wajib dipilih.');
    if (!(Number(form.biayaBulanan) > 0)) errors.push('Biaya Bulanan wajib lebih dari Rp 0 (cek harga paket, jangan kirim dengan Rp 0).');
  }
  return errors;
}

// Validasi lengkap sebelum submit — field bertanda wajib di form Runsnet asli (nama, kontak, branch,
// alamat, jenis tagihan, profile/paket). Diderivasi dari validateStepFields (step 1-3) supaya
// keduanya tidak bisa drift. Mengembalikan daftar pesan error (kosong = valid).
export function validateCustomerForm(form) {
  return [1, 2, 3].flatMap((step) => validateStepFields(step, form));
}

// Cabang yang didukung fitur ini (fase 1: hanya Kab. Muko Muko, sesuai area operasional utama).
export const SUPPORTED_BRANCHES = [
  { code: '1706', label: 'Kab. Muko Muko' },
];
