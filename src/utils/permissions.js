// Menu yang bisa diatur superadmin per-admin (dicentang di panel Akun Admin). Rute (/rute) sengaja tidak
// masuk sini — itu pelacakan lokasi live khusus superadmin, bukan menu yang bisa dipindah ke admin.
export const CONFIGURABLE_ADMIN_MENUS = [
  { path: '/', label: 'Beranda' },
  { path: '/pos', label: 'Transaksi' },
  { path: '/customers', label: 'Pelanggan' },
  { path: '/history', label: 'Riwayat' },
  { path: '/aktivitas', label: 'Aktivitas' },
  { path: '/settings', label: 'Pengaturan' },
];

// Daftar bawaan (perilaku lama): dipakai kalau superadmin belum pernah mengatur menu admin ini secara
// khusus (admin_profiles.allowed_paths masih null), supaya admin yang sudah ada tidak mendadak
// kehilangan akses begitu fitur ini aktif.
export const ADMIN_ALLOWED_PATHS = CONFIGURABLE_ADMIN_MENUS.map((m) => m.path);
export const ADMIN_DEFAULT_PATH = '/pos';

// allowedPaths: daftar path khusus admin ini (admin_profiles.allowed_paths), atau null/undefined kalau
// belum diatur superadmin (pakai daftar bawaan). Superadmin selalu boleh semua path, tidak terpengaruh.
export function isPathAllowedForRole(role, pathname, allowedPaths = null) {
  if (role === 'superadmin') return true;
  const list = Array.isArray(allowedPaths) ? allowedPaths : ADMIN_ALLOWED_PATHS;
  return list.includes(pathname);
}

// Menu (dari CONFIGURABLE_ADMIN_MENUS) yang tampil di navigasi untuk role+allowedPaths ini.
export function visibleMenusForRole(role, allowedPaths = null) {
  if (role === 'superadmin') return CONFIGURABLE_ADMIN_MENUS;
  const list = Array.isArray(allowedPaths) ? allowedPaths : ADMIN_ALLOWED_PATHS;
  return CONFIGURABLE_ADMIN_MENUS.filter((m) => list.includes(m.path));
}
