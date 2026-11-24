// Menu yang bisa diatur superadmin per-admin (dicentang di panel Akun Admin). Rute (/rute) tidak masuk
// sini: aksesnya ikut hak akses fitur 'rute.view' (lihat isPathAllowedForRole).
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

// Hak "buka halaman" per menu: menu baru bisa dibuka admin kalau menunya DAN hak ini sama-sama dicentang.
export const PAGE_VIEW_PERMISSION = {
  '/pos': 'pos.view',
  '/customers': 'customers.view',
  '/history': 'history.view',
  '/aktivitas': 'finance.view_activity',
  '/settings': 'settings.view',
};

// 9 Modul Pembagian Hak Akses Granular
export const PERMISSION_MODULES = [
  {
    id: 'pos',
    viewPermission: 'pos.view',
    label: 'Transaksi & Kasir (POS)',
    description: 'Akses transaksi kasir harian dan cetak struk',
    path: '/pos',
    permissions: [
      { id: 'pos.view', label: 'Buka Halaman Transaksi' },
      { id: 'pos.retail', label: 'Proses Pembayaran Retail Bulanan' },
      { id: 'pos.custom_price', label: 'Ubah Harga & Diskon Manual' },
      { id: 'pos.print', label: 'Cetak Struk Transaksi' },
    ],
  },
  {
    id: 'customers',
    viewPermission: 'customers.view',
    label: 'Manajemen Pelanggan',
    description: 'Kelola data pelanggan, koordinat, dan status langganan',
    path: '/customers',
    permissions: [
      { id: 'customers.view', label: 'Lihat Data Pelanggan' },
      { id: 'customers.create', label: 'Tambah Pelanggan Baru' },
      { id: 'customers.edit', label: 'Edit Profil, Paket & Titik Koordinat' },
      { id: 'customers.delete', label: 'Hapus Pelanggan' },
      { id: 'customers.export', label: 'Ekspor Data Pelanggan (Excel/CSV)' },
    ],
  },
  {
    id: 'history',
    viewPermission: 'history.view',
    label: 'Riwayat & Bukti Pembayaran',
    description: 'Lihat riwayat transaksi dan pengelolaan foto bukti transfer asli',
    path: '/history',
    permissions: [
      { id: 'history.view', label: 'Lihat Riwayat Transaksi' },
      { id: 'history.cancel', label: 'Batalkan / Refund Transaksi' },
      { id: 'history.proof_view', label: 'Lihat Foto Bukti Transfer Asli' },
      { id: 'history.proof_upload', label: 'Unggah / Ganti Foto Bukti Pembayaran' },
    ],
  },
  {
    id: 'rute',
    viewPermission: 'rute.view',
    label: 'Rute & Kunjungan Lapangan',
    description: 'Peta rute penagihan, survey, dan pelacakan teknisi',
    path: '/rute',
    permissions: [
      { id: 'rute.view', label: 'Buka Peta & Rute Lapangan' },
      { id: 'rute.reorder', label: 'Susun Urutan Rute Kunjungan' },
      { id: 'rute.visit', label: 'Catat Hasil Kunjungan Lapangan' },
    ],
  },
  {
    id: 'work',
    viewPermission: 'work.view',
    label: 'Start On Work (Kerja Lapangan)',
    description: 'Rute otomatis ke rumah pelanggan, lapor ada/tidak di rumah & janji bayar',
    path: '/start-on-work',
    permissions: [
      { id: 'work.view', label: 'Mulai Kerja & Lapor Kunjungan' },
      { id: 'work.pay_direct', label: 'Terima Bayar Langsung di Lokasi' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Gateway & Notifikasi',
    description: 'Kirim invoice otomatis dan pengingat tagihan',
    path: '/settings',
    permissions: [
      { id: 'whatsapp.invoice', label: 'Kirim Invoice & Struk via WA' },
      { id: 'whatsapp.reminder', label: 'Kirim Pengingat Jatuh Tempo / Isolir' },
      { id: 'whatsapp.logs', label: 'Lihat Log Pengiriman WhatsApp' },
    ],
  },
  {
    id: 'finance',
    viewPermission: 'finance.view_activity',
    label: 'Keuangan & Laporan Toko',
    description: 'Pantau aktivitas mutasi kas dan omset pendapatan toko',
    path: '/aktivitas',
    permissions: [
      { id: 'finance.view_activity', label: 'Buka Menu Aktivitas & Mutasi Kas' },
      { id: 'finance.view_omset', label: 'Lihat Total Omset & Laba Keseluruhan' },
    ],
  },
  {
    id: 'instansi',
    viewPermission: 'instansi.view',
    label: 'Invoice Instansi (B2B)',
    description: 'Buat, cetak & kirim invoice A4 untuk klien instansi/korporat',
    path: '/instansi',
    permissions: [
      { id: 'instansi.view', label: 'Buka, Buat & Cetak Invoice Instansi' },
      { id: 'instansi.delete', label: 'Hapus Klien & Invoice Instansi' },
    ],
  },
  {
    id: 'settings',
    viewPermission: 'settings.view',
    label: 'Pengaturan Sistem & Toko',
    description: 'Konfigurasi printer bluetooth, paket wifi, dan profil toko',
    path: '/settings',
    permissions: [
      { id: 'settings.view', label: 'Buka Halaman Pengaturan' },
      { id: 'settings.printer', label: 'Atur Printer Bluetooth' },
      { id: 'settings.packages', label: 'Tambah & Ubah Paket / Harga' },
      { id: 'settings.company', label: 'Ubah Info Toko & Biaya Admin' },
    ],
  },
  {
    id: 'runsnet',
    label: 'Integrasi Runsnet Billing',
    description: 'Sinkronisasi tagihan dan data pelanggan ke Runsnet',
    path: '/settings',
    permissions: [
      { id: 'runsnet.sync', label: 'Kirim Ulang Pembayaran ke Runsnet (manual)' },
      { id: 'runsnet.sync_customers', label: 'Tarik & Sinkronkan Pelanggan Runsnet' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.id));

export const DEFAULT_ADMIN_PERMISSIONS = [
  'pos.view', 'pos.retail', 'pos.print', 'pos.custom_price',
  'customers.view', 'customers.create', // customers.edit bukan bawaan: edit pelanggan dulu khusus superadmin
  'history.view', 'history.proof_view', 'history.proof_upload',
  'rute.visit', // rute.view sengaja tidak bawaan: halaman Rute hanya untuk admin yang dicentang superadmin
  'whatsapp.invoice', 'whatsapp.reminder',
  'finance.view_activity', 'finance.view_omset',
  'settings.view', 'settings.printer',
];

/**
 * Normalisasi data akses admin baik format lama (Array string) maupun format baru (Objek JSONB).
 * Backward compatible: jika allowed_paths masih array string (perilaku lama), otomatis dipetakan
 * ke permission berdasarkan menu yang diizinkan agar admin tidak kehilangan akses.
 */
export function normalizeAdminAccess(allowedPaths) {
  if (!allowedPaths) {
    return {
      paths: ADMIN_ALLOWED_PATHS,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      map_icon: null,
      commissions: [],
      bonuses: [],
    };
  }

  if (Array.isArray(allowedPaths)) {
    // Format array lama: tentukan permissions berdasarkan menu yang diizinkan
    const perms = [];
    if (allowedPaths.includes('/')) perms.push('whatsapp.reminder', 'finance.view_omset');
    if (allowedPaths.includes('/pos')) perms.push('pos.view', 'pos.retail', 'pos.print', 'pos.custom_price', 'whatsapp.invoice');
    if (allowedPaths.includes('/customers')) perms.push('customers.view', 'customers.create');
    if (allowedPaths.includes('/history')) perms.push('history.view', 'history.proof_view', 'history.proof_upload');
    if (allowedPaths.includes('/aktivitas')) perms.push('finance.view_activity');
    if (allowedPaths.includes('/settings')) perms.push('settings.view', 'settings.printer');
    return {
      paths: allowedPaths,
      permissions: perms,
      map_icon: null,
      commissions: [],
      bonuses: [],
    };
  }

  if (typeof allowedPaths === 'object') {
    return {
      paths: Array.isArray(allowedPaths.paths) ? allowedPaths.paths : ADMIN_ALLOWED_PATHS,
      permissions: Array.isArray(allowedPaths.permissions) ? allowedPaths.permissions : DEFAULT_ADMIN_PERMISSIONS,
      map_icon: allowedPaths.map_icon || null,
      commissions: Array.isArray(allowedPaths.commissions) ? allowedPaths.commissions : [],
      bonuses: Array.isArray(allowedPaths.bonuses) ? allowedPaths.bonuses : [],
    };
  }

  return {
    paths: ADMIN_ALLOWED_PATHS,
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    map_icon: null,
    commissions: [],
    bonuses: [],
  };
}

/**
 * Pengecekan apakah user memiliki permission spesifik.
 * Superadmin selalu memiliki seluruh permission.
 */
export function hasPermission(role, permissionKey, adminAccess = null) {
  if (role === 'superadmin') return true;
  const access = normalizeAdminAccess(adminAccess);
  return access.permissions.includes(permissionKey);
}

// allowedPaths: daftar path khusus admin ini (admin_profiles.allowed_paths), atau null/undefined kalau
// belum diatur superadmin (pakai daftar bawaan). Superadmin selalu boleh semua path, tidak terpengaruh.
export function isPathAllowedForRole(role, pathname, allowedPaths = null) {
  if (role === 'superadmin') return true;
  const cleanPath = (pathname || '').split('?')[0].split('#')[0];
  const access = normalizeAdminAccess(allowedPaths);
  if (cleanPath === '/rute') return access.permissions.includes('rute.view');
  if (cleanPath === '/pelanggan-runsnet-baru') return access.permissions.includes('customers.create');
  if (cleanPath === '/instansi') return access.permissions.includes('instansi.view');
  if (cleanPath === '/start-on-work') return access.permissions.includes('work.view');
  const viewPermission = PAGE_VIEW_PERMISSION[cleanPath];
  return access.paths.includes(cleanPath) && (!viewPermission || access.permissions.includes(viewPermission));
}

// Menu (dari CONFIGURABLE_ADMIN_MENUS) yang tampil di navigasi untuk role+allowedPaths ini.
export function visibleMenusForRole(role, allowedPaths = null) {
  if (role === 'superadmin') return CONFIGURABLE_ADMIN_MENUS;
  return CONFIGURABLE_ADMIN_MENUS.filter((m) => isPathAllowedForRole(role, m.path, allowedPaths));
}
