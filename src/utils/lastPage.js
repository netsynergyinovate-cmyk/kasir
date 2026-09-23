// Mengingat halaman & rute terakhir yang dibuka (termasuk parameter query tab),
// supaya membuka ulang aplikasi atau refresh browser kembali ke posisi yang sama persis.
const KEY = 'kasir_last_path';

export function saveLastPath(fullPath) {
  if (!fullPath) return;
  try {
    localStorage.setItem(KEY, fullPath);
  } catch {
    // localStorage tidak tersedia (mode privat dll) — diam saja, tidak fatal.
  }
}

export function getLastPath() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLastPath() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
