// Jembatan antara registrasi service worker (main.jsx) dan banner "Versi baru tersedia" di App.
export const UPDATE_READY_EVENT = 'kasir:update-ready';

let applyUpdate = null;

export function setApplyUpdate(fn) {
  applyUpdate = fn;
}

// Memasang versi baru dan memuat ulang halaman. false kalau service worker belum siap.
export function applyPendingUpdate() {
  if (!applyUpdate) return false;
  applyUpdate();
  return true;
}
