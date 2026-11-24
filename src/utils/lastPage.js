// Mengingat halaman & rute terakhir yang dibuka (termasuk parameter query tab) supaya REFRESH kembali ke
// posisi yang sama persis. Disimpan di sessionStorage: hilang saat aplikasi/tab ditutup, jadi membuka
// aplikasi lagi selalu mulai dari Beranda.
const KEY = 'kasir_last_path';

export function saveLastPath(fullPath) {
  if (!fullPath) return;
  try {
    sessionStorage.setItem(KEY, fullPath);
  } catch {
    // sessionStorage tidak tersedia (mode privat dll) — diam saja, tidak fatal.
  }
}

export function getLastPath() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLastPath() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
