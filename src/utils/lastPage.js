// Mengingat halaman terakhir yang dibuka, supaya membuka ulang aplikasi (ikon PWA selalu mulai dari
// start_url '/', bukan halaman terakhir) kembali ke halaman yang sama, bukan ke Beranda.
const KEY = 'kasir_last_path';

// '/' sendiri tidak perlu disimpan/dipulihkan — itu sudah jadi titik awal PWA.
export function saveLastPath(pathname) {
  if (!pathname || pathname === '/') return;
  try {
    localStorage.setItem(KEY, pathname);
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
