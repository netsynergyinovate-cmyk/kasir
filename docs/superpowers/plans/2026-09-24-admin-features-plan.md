# Kustomisasi Icon Map Admin, Hak Akses Granular, Sistem Komisi & Upgrade UI Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi kustomisasi icon peta admin unik dengan live preview, sistem pembagian hak akses granular 8 modul per-fitur mandiri, sistem transfer komisi kasir oleh Super Admin dengan tampilan riwayat di Dashboard Admin, serta upgrade UI Settings.

**Architecture:** Menggunakan arsitektur hybrid JSONB pada kolom `admin_profiles.allowed_paths` untuk persistensi instan tanpa jeda migrasi DDL, dilengkapi skrip migrasi relasional pendamping (`supabase_admin_commissions.sql`). Memanfaatkan Leaflet `L.divIcon` dinamis berdimensi 40x48px dengan pin lencana bulat, SVG kendaraan, inisial, dan label nama mengambang. Menggunakan fungsi normalisasi backwards-compatible untuk transisi aman data array lama ke objek permission.

**Tech Stack:** React 19, Leaflet / React-Leaflet, Supabase Client (PostgreSQL / JSONB), Tailwind CSS, Lucide React, Vitest.

## Global Constraints

- Wajib menjaga jumlah serverless function di `api/` tetap maksimal 12 file.
- Mempertahankan 100% kelulusan seluruh 53 file test (444 tests) yang sudah ada sebelumnya.
- Nol gambar buatan/palsu untuk bukti pembayaran; hanya foto asli yang diizinkan.
- Format mata uang menggunakan helper resmi `formatRupiah` dari `src/utils/format.js`.
- Semua modifikasi aman terhadap kompatibilitas mundur (array string `allowed_paths` lama otomatis dinormalisasi).

---

### Task 1: Admin Map Icons Unit Testing & Fallback Verification

**Files:**
- Test: `src/utils/__tests__/adminMapIcons.test.js`
- Modify: `src/utils/adminMapIcons.js`

**Interfaces:**
- Consumes: `src/utils/adminMapIcons.js` (`MAP_ICON_TYPES`, `MAP_ICON_COLORS`, `getDeterministicColor`, `getInitials`, `createAdminMapIcon`)
- Produces: Verified unit tests for map icon rendering, deterministic color calculation, initials extraction, and Leaflet divIcon structure.

- [ ] **Step 1: Write the unit test suite**

Create `src/utils/__tests__/adminMapIcons.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { 
  MAP_ICON_TYPES, 
  MAP_ICON_COLORS, 
  getDeterministicColor, 
  getInitials, 
  createAdminMapIcon 
} from '../adminMapIcons';

describe('adminMapIcons', () => {
  it('defines 7 map icon types with SVG and iconText', () => {
    expect(MAP_ICON_TYPES).toHaveLength(7);
    const ids = MAP_ICON_TYPES.map(t => t.id);
    expect(ids).toContain('motor');
    expect(ids).toContain('mobil');
    expect(ids).toContain('technician');
    expect(ids).toContain('person');
    expect(ids).toContain('admin');
    expect(ids).toContain('crown');
    expect(ids).toContain('beacon');

    MAP_ICON_TYPES.forEach(t => {
      expect(t.svg).toContain('<svg');
      expect(t.iconText).toBeDefined();
      expect(t.label).toBeDefined();
    });
  });

  it('defines 8 vibrant theme colors', () => {
    expect(MAP_ICON_COLORS).toHaveLength(8);
    MAP_ICON_COLORS.forEach(c => {
      expect(c.value).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('generates deterministic color from string', () => {
    const color1 = getDeterministicColor('Budi Santoso');
    const color2 = getDeterministicColor('Budi Santoso');
    const color3 = getDeterministicColor('Ahmad Dahlan');
    expect(color1).toBe(color2);
    expect(typeof color1).toBe('string');
    expect(color1).toMatch(/^#/);
    expect(MAP_ICON_COLORS.map(c => c.value)).toContain(color1);
  });

  it('extracts initials properly', () => {
    expect(getInitials('Budi Santoso')).toBe('BS');
    expect(getInitials('Agus')).toBe('A');
    expect(getInitials('Muhammad Rizki Pratama')).toBe('MR');
    expect(getInitials('')).toBe('?');
  });

  it('creates Leaflet divIcon with proper dimensions and custom config', () => {
    const icon = createAdminMapIcon({
      id: 'admin-1',
      name: 'Rudi Teknisi',
      role: 'admin',
      map_icon: {
        type: 'technician',
        color: '#10b981',
        label: 'RT'
      }
    });

    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-admin-marker');
    expect(icon.options.iconSize).toEqual([40, 48]);
    expect(icon.options.html).toContain('Rudi Teknisi');
    expect(icon.options.html).toContain('#10b981');
    expect(icon.options.html).toContain('RT');
  });

  it('handles superadmin role and self location marker', () => {
    const iconSuper = createAdminMapIcon({
      id: 'super-1',
      name: 'Owner',
      role: 'superadmin'
    });
    expect(iconSuper.options.html).toContain('👑');

    const iconSelf = createAdminMapIcon({
      id: 'self-1',
      name: 'Saya',
      role: 'admin'
    }, true);
    expect(iconSelf.options.html).toContain('Posisi Anda');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/adminMapIcons.test.js`
Expected: PASS with 6 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/adminMapIcons.test.js
git commit -m "test: add unit test suite for admin map icons"
```

---

### Task 2: Permissions System Granular Module & Feature Access

**Files:**
- Modify: `src/utils/permissions.js`
- Test: `src/utils/__tests__/permissions.test.js`

**Interfaces:**
- Consumes: Nothing
- Produces:
  - `PERMISSION_MODULES`: Array of 8 modules `{ id, label, description, permissions: [{ id, label }] }`
  - `ALL_PERMISSIONS`: Flat list of all permission IDs
  - `DEFAULT_ADMIN_PERMISSIONS`: Default feature permissions for legacy admins
  - `normalizeAdminAccess(allowedPaths)`: Helper mapping array / object to `{ paths, permissions, map_icon, commissions }`
  - `hasPermission(role, permissionKey, allowedPaths = null)`: Boolean check
  - `isPathAllowedForRole(role, pathname, allowedPaths = null)`: Updated to support object or array format
  - `visibleMenusForRole(role, allowedPaths = null)`: Updated to support object or array format

- [ ] **Step 1: Write the failing tests in permissions.test.js**

Add the following tests to `src/utils/__tests__/permissions.test.js`:
```javascript
import { 
  PERMISSION_MODULES, 
  ALL_PERMISSIONS, 
  DEFAULT_ADMIN_PERMISSIONS, 
  normalizeAdminAccess, 
  hasPermission 
} from '../permissions';

describe('normalizeAdminAccess', () => {
  it('normalizes null/undefined to default paths and permissions', () => {
    const normalized = normalizeAdminAccess(null);
    expect(normalized.paths).toEqual(ADMIN_ALLOWED_PATHS);
    expect(normalized.permissions).toEqual(DEFAULT_ADMIN_PERMISSIONS);
    expect(normalized.map_icon).toBeNull();
    expect(normalized.commissions).toEqual([]);
  });

  it('normalizes legacy array format to structured object', () => {
    const legacy = ['/pos', '/customers'];
    const normalized = normalizeAdminAccess(legacy);
    expect(normalized.paths).toEqual(legacy);
    expect(normalized.permissions).toContain('pos.view');
    expect(normalized.permissions).toContain('customers.view');
    expect(normalized.permissions).not.toContain('history.view');
  });

  it('preserves existing object format and custom fields', () => {
    const custom = {
      paths: ['/pos'],
      permissions: ['pos.view', 'pos.retail'],
      map_icon: { type: 'motor', color: '#10b981', label: 'RD' },
      commissions: [{ id: 'comm-1', amount: 50000 }]
    };
    const normalized = normalizeAdminAccess(custom);
    expect(normalized.paths).toEqual(['/pos']);
    expect(normalized.permissions).toEqual(['pos.view', 'pos.retail']);
    expect(normalized.map_icon.type).toBe('motor');
    expect(normalized.commissions).toHaveLength(1);
  });
});

describe('hasPermission', () => {
  it('allows superadmin any permission', () => {
    expect(hasPermission('superadmin', 'customers.delete')).toBe(true);
    expect(hasPermission('superadmin', 'finance.view_omset')).toBe(true);
    expect(hasPermission('superadmin', 'settings.company')).toBe(true);
  });

  it('allows admin based on configured permissions', () => {
    const access = {
      paths: ['/pos'],
      permissions: ['pos.view', 'pos.retail', 'pos.print']
    };
    expect(hasPermission('admin', 'pos.view', access)).toBe(true);
    expect(hasPermission('admin', 'pos.retail', access)).toBe(true);
    expect(hasPermission('admin', 'pos.custom_price', access)).toBe(false);
    expect(hasPermission('admin', 'customers.delete', access)).toBe(false);
  });

  it('falls back to default permissions for unconfigured admin', () => {
    expect(hasPermission('admin', 'pos.view', null)).toBe(true);
    expect(hasPermission('admin', 'pos.retail', null)).toBe(true);
    expect(hasPermission('admin', 'settings.company', null)).toBe(false);
  });
});

describe('isPathAllowedForRole with object format', () => {
  it('allows path when contained in object paths', () => {
    const access = { paths: ['/pos', '/history'], permissions: [] };
    expect(isPathAllowedForRole('admin', '/pos', access)).toBe(true);
    expect(isPathAllowedForRole('admin', '/history', access)).toBe(true);
    expect(isPathAllowedForRole('admin', '/customers', access)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/permissions.test.js`
Expected: FAIL with "normalizeAdminAccess is not defined" or "hasPermission is not defined".

- [ ] **Step 3: Implement modular permissions in permissions.js**

Update `src/utils/permissions.js`:
```javascript
// Menu yang bisa diatur superadmin per-admin (dicentang di panel Akun Admin).
export const CONFIGURABLE_ADMIN_MENUS = [
  { path: '/', label: 'Beranda' },
  { path: '/pos', label: 'Transaksi' },
  { path: '/customers', label: 'Pelanggan' },
  { path: '/history', label: 'Riwayat' },
  { path: '/aktivitas', label: 'Aktivitas' },
  { path: '/settings', label: 'Pengaturan' },
];

export const ADMIN_ALLOWED_PATHS = CONFIGURABLE_ADMIN_MENUS.map((m) => m.path);
export const ADMIN_DEFAULT_PATH = '/pos';

// 8 Modul Pembagian Hak Akses Granular
export const PERMISSION_MODULES = [
  {
    id: 'pos',
    label: 'Transaksi & Kasir (POS)',
    description: 'Akses transaksi kasir harian, cetak struk, dan penjualan voucher',
    path: '/pos',
    permissions: [
      { id: 'pos.view', label: 'Buka Halaman Transaksi' },
      { id: 'pos.retail', label: 'Proses Pembayaran Retail Bulanan' },
      { id: 'pos.voucher', label: 'Penjualan Voucher WiFi/Hotspot' },
      { id: 'pos.custom_price', label: 'Ubah Harga & Diskon Manual' },
      { id: 'pos.print', label: 'Cetak Struk Transaksi' },
    ],
  },
  {
    id: 'customers',
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
    label: 'Keuangan & Laporan Toko',
    description: 'Pantau aktivitas mutasi kas dan omset pendapatan toko',
    path: '/aktivitas',
    permissions: [
      { id: 'finance.view_activity', label: 'Buka Menu Aktivitas & Mutasi Kas' },
      { id: 'finance.view_omset', label: 'Lihat Total Omset & Laba Keseluruhan' },
    ],
  },
  {
    id: 'settings',
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
      { id: 'runsnet.sync', label: 'Kirim Status Pembayaran ke Runsnet' },
      { id: 'runsnet.sync_customers', label: 'Tarik & Sinkronkan Pelanggan Runsnet' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.id));

export const DEFAULT_ADMIN_PERMISSIONS = [
  'pos.view', 'pos.retail', 'pos.voucher', 'pos.print',
  'customers.view', 'customers.create', 'customers.edit',
  'history.view', 'history.proof_view', 'history.proof_upload',
  'rute.view', 'rute.visit',
  'whatsapp.invoice',
  'finance.view_activity',
  'settings.view', 'settings.printer',
];

/**
 * Normalisasi data akses admin baik format lama (Array string) maupun format baru (Objek JSONB).
 */
export function normalizeAdminAccess(allowedPaths) {
  if (!allowedPaths) {
    return {
      paths: ADMIN_ALLOWED_PATHS,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      map_icon: null,
      commissions: [],
    };
  }

  if (Array.isArray(allowedPaths)) {
    // Format array lama: tentukan permissions berdasarkan menu yang diizinkan
    const perms = [];
    if (allowedPaths.includes('/pos')) perms.push('pos.view', 'pos.retail', 'pos.voucher', 'pos.print');
    if (allowedPaths.includes('/customers')) perms.push('customers.view', 'customers.create', 'customers.edit');
    if (allowedPaths.includes('/history')) perms.push('history.view', 'history.proof_view', 'history.proof_upload');
    if (allowedPaths.includes('/aktivitas')) perms.push('finance.view_activity');
    if (allowedPaths.includes('/settings')) perms.push('settings.view', 'settings.printer');
    return {
      paths: allowedPaths,
      permissions: perms,
      map_icon: null,
      commissions: [],
    };
  }

  if (typeof allowedPaths === 'object') {
    return {
      paths: Array.isArray(allowedPaths.paths) ? allowedPaths.paths : ADMIN_ALLOWED_PATHS,
      permissions: Array.isArray(allowedPaths.permissions) ? allowedPaths.permissions : DEFAULT_ADMIN_PERMISSIONS,
      map_icon: allowedPaths.map_icon || null,
      commissions: Array.isArray(allowedPaths.commissions) ? allowedPaths.commissions : [],
    };
  }

  return {
    paths: ADMIN_ALLOWED_PATHS,
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    map_icon: null,
    commissions: [],
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

// allowedPaths: daftar path khusus admin ini (admin_profiles.allowed_paths), atau null/undefined
export function isPathAllowedForRole(role, pathname, allowedPaths = null) {
  if (role === 'superadmin') return true;
  const cleanPath = (pathname || '').split('?')[0].split('#')[0];
  const access = normalizeAdminAccess(allowedPaths);
  return access.paths.includes(cleanPath);
}

// Menu (dari CONFIGURABLE_ADMIN_MENUS) yang tampil di navigasi untuk role+allowedPaths ini.
export function visibleMenusForRole(role, allowedPaths = null) {
  if (role === 'superadmin') return CONFIGURABLE_ADMIN_MENUS;
  const access = normalizeAdminAccess(allowedPaths);
  return CONFIGURABLE_ADMIN_MENUS.filter((m) => access.paths.includes(m.path));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/permissions.test.js`
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/permissions.js src/utils/__tests__/permissions.test.js
git commit -m "feat: add granular module and feature permissions with backward compatibility"
```

---

### Task 3: Commissions Engine & Unit Tests

**Files:**
- Create: `src/utils/commissions.js`
- Test: `src/utils/__tests__/commissions.test.js`

**Interfaces:**
- Consumes: `src/utils/dashboardStats.js` (`isOwnTransaction`), `src/lib/supabase.js`
- Produces:
  - `calculateAdminCommissions(transactions, adminId, adminName, adminFee, commissionHistory)`
  - `createCommissionPayout({ adminId, adminName, amount, paymentMethod, notes, sentByName })`
  - `recordCommissionPayout(admin, payoutRecord)`

- [ ] **Step 1: Write the failing unit tests for commissions**

Create `src/utils/__tests__/commissions.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { 
  calculateAdminCommissions, 
  createCommissionPayout 
} from '../commissions';

describe('calculateAdminCommissions', () => {
  const transactions = [
    { id: 't1', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-1', cashier_name: 'Budi' },
    { id: 't2', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-1', cashier_name: 'Budi' },
    { id: 't3', status: 'LUNAS', type: 'retail', payment_method: 'CS', cashier_id: 'adm-1', cashier_name: 'Budi' }, // CS excluded
    { id: 't4', status: 'PENDING', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-1', cashier_name: 'Budi' }, // Unpaid excluded
    { id: 't5', status: 'LUNAS', type: 'retail', payment_method: 'CASH', cashier_id: 'adm-2', cashier_name: 'Siti' }, // Other admin
  ];

  it('calculates total earned, paid, and pending accurately', () => {
    const history = [
      { id: 'c1', amount: 10000, status: 'TERKIRIM' },
    ];
    const result = calculateAdminCommissions(transactions, 'adm-1', 'Budi', 10000, history);
    
    expect(result.earnedTrxCount).toBe(2);
    expect(result.totalEarned).toBe(20000);
    expect(result.totalPaid).toBe(10000);
    expect(result.pendingBalance).toBe(10000);
    expect(result.history).toHaveLength(1);
  });

  it('handles zero commission history gracefully', () => {
    const result = calculateAdminCommissions(transactions, 'adm-1', 'Budi', 5000, []);
    expect(result.totalEarned).toBe(10000);
    expect(result.totalPaid).toBe(0);
    expect(result.pendingBalance).toBe(10000);
  });
});

describe('createCommissionPayout', () => {
  it('creates valid commission payout entry with required fields', () => {
    const payout = createCommissionPayout({
      adminId: 'adm-1',
      adminName: 'Budi',
      amount: 50000,
      paymentMethod: 'Transfer Bank (BCA)',
      notes: 'Komisi September 2026',
      sentByName: 'CS NET.SI'
    });

    expect(payout.id).toMatch(/^COMM-/);
    expect(payout.admin_id).toBe('adm-1');
    expect(payout.admin_name).toBe('Budi');
    expect(payout.amount).toBe(50000);
    expect(payout.payment_method).toBe('Transfer Bank (BCA)');
    expect(payout.notes).toBe('Komisi September 2026');
    expect(payout.status).toBe('TERKIRIM');
    expect(payout.sent_by_name).toBe('CS NET.SI');
    expect(payout.sent_at).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/commissions.test.js`
Expected: FAIL with "Cannot find module '../commissions'".

- [ ] **Step 3: Implement src/utils/commissions.js**

Create `src/utils/commissions.js`:
```javascript
import { isOwnTransaction } from './dashboardStats';
import { supabase } from '../lib/supabase';
import { normalizeAdminAccess } from './permissions';

/**
 * Kalkulasi komisi admin:
 * - totalEarned: Jumlah transaksi lunas yang diproses admin * adminFee
 * - totalPaid: Total komisi yang sudah ditransfer oleh superadmin
 * - pendingBalance: Sisa komisi yang belum dicairkan (minimal 0)
 */
export function calculateAdminCommissions(transactions = [], adminId = '', adminName = '', adminFee = 10000, commissionHistory = []) {
  const matchingTrx = transactions.filter((t) => {
    const isPaid = t.status === 'LUNAS' || t.type === 'instansi';
    const notCS = t.payment_method !== 'CS';
    return isPaid && notCS && isOwnTransaction(t, adminId, adminName);
  });

  const totalEarned = matchingTrx.length * (Number(adminFee) || 10000);
  const validHistory = Array.isArray(commissionHistory) ? commissionHistory : [];
  const totalPaid = validHistory
    .filter((c) => c.status === 'TERKIRIM')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const pendingBalance = Math.max(0, totalEarned - totalPaid);

  return {
    earnedTrxCount: matchingTrx.length,
    totalEarned,
    totalPaid,
    pendingBalance,
    history: validHistory,
  };
}

/**
 * Membuat objek catatan transfer komisi baru.
 */
export function createCommissionPayout({
  adminId,
  adminName,
  amount,
  paymentMethod = 'Transfer Bank',
  notes = '',
  sentByName = 'Super Admin',
}) {
  return {
    id: `COMM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    admin_id: adminId,
    admin_name: adminName,
    amount: Number(amount) || 0,
    payment_method: paymentMethod,
    notes: notes || 'Pencairan komisi jasa kasir',
    status: 'TERKIRIM',
    sent_by_name: sentByName,
    sent_at: new Date().toISOString(),
  };
}

/**
 * Simpan transfer komisi ke admin_profiles.allowed_paths (JSONB) dengan fallback aman.
 * Jika tabel relasional `admin_commissions` sudah tersedia di Supabase, data juga disimpan ke sana.
 */
export async function recordCommissionPayout(admin, payoutRecord) {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  const updatedCommissions = [payoutRecord, ...(currentAccess.commissions || [])];

  const updatedPayload = {
    ...currentAccess,
    commissions: updatedCommissions,
  };

  // 1. Update ke admin_profiles (selalu berhasil karena hybrid JSONB)
  const { error: profileError } = await supabase
    .from('admin_profiles')
    .update({ allowed_paths: updatedPayload })
    .eq('id', admin.id);

  if (profileError) throw profileError;

  // 2. Upaya opsional simpan ke tabel relasional admin_commissions jika tabel sudah ada
  try {
    await supabase.from('admin_commissions').insert({
      id: payoutRecord.id,
      admin_id: admin.id,
      admin_name: admin.full_name || payoutRecord.admin_name,
      amount: payoutRecord.amount,
      payment_method: payoutRecord.payment_method,
      notes: payoutRecord.notes,
      status: payoutRecord.status,
      sent_by_name: payoutRecord.sent_by_name,
      sent_at: payoutRecord.sent_at,
    });
  } catch (err) {
    // Ignored jika tabel belum dimigrasikan
    console.warn('Tabel admin_commissions belum aktif, data tersimpan di hybrid JSONB:', err?.message);
  }

  return updatedPayload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/commissions.test.js`
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/commissions.js src/utils/__tests__/commissions.test.js
git commit -m "feat: add commissions calculation and payout recording engine"
```

---

### Task 4: Granular Access Control Modal (`AdminAccessModal.jsx`)

**Files:**
- Modify: `src/components/AdminAccessModal.jsx`
- Test: `src/components/__tests__/AdminAccessModal.test.jsx`

**Interfaces:**
- Consumes: `src/utils/permissions.js` (`PERMISSION_MODULES`, `ALL_PERMISSIONS`, `normalizeAdminAccess`), `src/utils/adminMapIcons.js` (`MAP_ICON_TYPES`, `MAP_ICON_COLORS`, `getInitials`, `getDeterministicColor`)
- Produces: Modal with 3 organized tabs/sections:
  1. Hak Akses Fitur (8 Modul, checklist granular per-fitur, tombol Pilih Semua / Batal Semua)
  2. Icon Peta (7 icon kendaraan/peran, 8 warna, inisial/label)
  3. Batasi Pelanggan (pencarian dan checklist per-pelanggan)

- [ ] **Step 1: Write component unit test**

Create `src/components/__tests__/AdminAccessModal.test.jsx`:
```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AdminAccessModal from '../AdminAccessModal';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [] }),
        eq: () => Promise.resolve({ data: [] })
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null })
    })
  }
}));

describe('AdminAccessModal', () => {
  const dummyAdmin = {
    id: 'adm-123',
    full_name: 'Budi Santoso',
    email: 'budi@example.com',
    allowed_paths: {
      paths: ['/pos'],
      permissions: ['pos.view', 'pos.retail'],
      map_icon: { type: 'motor', color: '#10b981', label: 'BS' },
      commissions: []
    }
  };

  it('renders modal with admin name and tabs', async () => {
    render(<AdminAccessModal admin={dummyAdmin} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText('Atur Akses')).toBeInTheDocument();
    expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument();
    expect(screen.getByText('Hak Akses Fitur')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or needs implementation**

Run: `npx vitest run src/components/__tests__/AdminAccessModal.test.jsx`
Expected: Checks if existing modal renders or tests need tab structure.

- [ ] **Step 3: Upgrade AdminAccessModal.jsx**

Update `src/components/AdminAccessModal.jsx` to render:
- Tabs for "Hak Akses Fitur", "Icon Peta", and "Batasi Pelanggan"
- 8 Modules with collapsible cards, Select All / Deselect All per module
- Icon type picker (7 types), color picker (8 colors), custom initial label
- Preserves existing `commissions` and customer restriction logic
- Saves structured object to `admin_profiles.allowed_paths`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/AdminAccessModal.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminAccessModal.jsx src/components/__tests__/AdminAccessModal.test.jsx
git commit -m "feat: upgrade AdminAccessModal with granular feature checklist and map icon picker"
```

---

### Task 5: Superadmin Commission Transfer Modal (`AdminCommissionModal.jsx`)

**Files:**
- Create: `src/components/AdminCommissionModal.jsx`
- Test: `src/components/__tests__/AdminCommissionModal.test.jsx`

**Interfaces:**
- Consumes: `src/utils/commissions.js`, `src/utils/format.js` (`formatRupiah`), `src/utils/permissions.js`
- Produces: `AdminCommissionModal` component allowing Super Admin to:
  - View calculated earned commission, paid commission, and pending balance.
  - Transfer commissions with quick "Kirim Semua" button or custom nominal.
  - Select payment method (BCA, BRI, Mandiri, BNI, Dana, GoPay, Tunai, Lainnya).
  - Add transfer note / period description.
  - View full commission history table with status badge.

- [ ] **Step 1: Write component unit test**

Create `src/components/__tests__/AdminCommissionModal.test.jsx`:
```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AdminCommissionModal from '../AdminCommissionModal';

describe('AdminCommissionModal', () => {
  const dummyAdmin = {
    id: 'adm-1',
    full_name: 'Budi Santoso',
    email: 'budi@example.com',
    allowed_paths: {
      commissions: [
        { id: 'c1', amount: 50000, payment_method: 'Transfer Bank (BCA)', notes: 'Periode 1', status: 'TERKIRIM', sent_at: new Date().toISOString() }
      ]
    }
  };

  const dummyTransactions = [
    { id: 't1', status: 'LUNAS', type: 'retail', price: 150000, cashier_id: 'adm-1' },
    { id: 't2', status: 'LUNAS', type: 'retail', price: 150000, cashier_id: 'adm-1' }
  ];

  it('renders admin commission information and payout options', () => {
    render(
      <AdminCommissionModal
        admin={dummyAdmin}
        transactions={dummyTransactions}
        companyInfo={{ adminFee: 10000 }}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );

    expect(screen.getByText('Kelola & Kirim Komisi')).toBeInTheDocument();
    expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument();
    expect(screen.getByText(/Riwayat Pencairan Komisi/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/AdminCommissionModal.test.jsx`
Expected: FAIL with "Cannot find module '../AdminCommissionModal'".

- [ ] **Step 3: Implement src/components/AdminCommissionModal.jsx**

Create `src/components/AdminCommissionModal.jsx`:
```javascript
import { useState } from 'react';
import { X, Send, CheckCircle2, Loader2, DollarSign, CreditCard, History, AlertCircle } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { calculateAdminCommissions, createCommissionPayout, recordCommissionPayout } from '../utils/commissions';
import { normalizeAdminAccess } from '../utils/permissions';

const PAYMENT_METHODS = [
  'Transfer Bank (BCA)',
  'Transfer Bank (BRI)',
  'Transfer Bank (Mandiri)',
  'Transfer Bank (BNI)',
  'E-Wallet (Dana)',
  'E-Wallet (GoPay / OVO)',
  'Tunai / Cash',
  'Lainnya',
];

const AdminCommissionModal = ({ admin, transactions = [], companyInfo = {}, session, onClose, onSaved }) => {
  const currentAccess = normalizeAdminAccess(admin.allowed_paths);
  const commissionData = calculateAdminCommissions(
    transactions,
    admin.id,
    admin.full_name,
    companyInfo.adminFee || 10000,
    currentAccess.commissions || []
  );

  const [amount, setAmount] = useState(commissionData.pendingBalance > 0 ? String(commissionData.pendingBalance) : '');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendAll = () => {
    setAmount(String(commissionData.pendingBalance));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Masukkan nominal komisi yang valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payout = createCommissionPayout({
        adminId: admin.id,
        adminName: admin.full_name,
        amount: numericAmount,
        paymentMethod,
        notes: notes.trim() || `Pencairan komisi per ${new Date().toLocaleDateString('id-ID')}`,
        sentByName: session?.profile?.full_name || 'Super Admin',
      });

      await recordCommissionPayout(admin, payout);

      setSuccessMsg(`Komisi sebesar ${formatRupiah(numericAmount)} berhasil dikirim dan dicatat!`);
      setAmount('');
      setNotes('');
      onSaved?.();
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (err) {
      setErrorMsg('Gagal mengirim komisi: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 relative space-y-5" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
          <X size={18} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-gray-900">Kelola & Kirim Komisi</h3>
              <p className="text-xs text-gray-500">{admin.full_name}{admin.email ? ` · ${admin.email}` : ''}</p>
            </div>
          </div>
        </div>

        {/* Ringkasan Saldo Komisi */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Diperoleh</p>
            <p className="text-xs font-black text-gray-800 mt-0.5">{formatRupiah(commissionData.totalEarned)}</p>
            <p className="text-[9px] text-gray-400">{commissionData.earnedTrxCount} Trx</p>
          </div>
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Sudah Cair</p>
            <p className="text-xs font-black text-emerald-600 mt-0.5">{formatRupiah(commissionData.totalPaid)}</p>
            <p className="text-[9px] text-gray-400">{commissionData.history.length} x Transfer</p>
          </div>
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Sisa Pending</p>
            <p className="text-xs font-black text-amber-600 mt-0.5">{formatRupiah(commissionData.pendingBalance)}</p>
            <p className="text-[9px] text-gray-400">Siap Ditransfer</p>
          </div>
        </div>

        {/* Form Kirim Komisi */}
        <form onSubmit={handleSubmit} className="space-y-3.5 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={14} className="text-blue-600" /> Form Kirim Komisi
            </label>
            {commissionData.pendingBalance > 0 && (
              <button
                type="button"
                onClick={handleSendAll}
                className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                Kirim Semua Sisa
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={14} /> {successMsg}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nominal Komisi (Rp)</label>
            <input
              type="number"
              min="1000"
              step="1000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 150000"
              className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm font-black text-gray-800 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Metode Pembayaran</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-700"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Keterangan / Periode</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Komisi Sep 2026"
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium text-gray-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-md shadow-emerald-100"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {isSubmitting ? 'Memproses...' : 'Kirim & Catat Komisi'}
          </button>
        </form>

        {/* Riwayat Pengiriman Komisi */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <History size={12} /> Riwayat Pencairan Komisi
            </p>
            <span className="text-[10px] text-gray-400">{commissionData.history.length} Catatan</span>
          </div>

          {commissionData.history.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">Belum ada riwayat transfer komisi.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {commissionData.history.map((item) => (
                <div key={item.id} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{item.notes || 'Pencairan Komisi'}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                      <span>{new Date(item.sent_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      <span className="font-semibold text-gray-600">{item.payment_method}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-emerald-600">+{formatRupiah(item.amount)}</p>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                      TERKIRIM
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCommissionModal;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/AdminCommissionModal.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminCommissionModal.jsx src/components/__tests__/AdminCommissionModal.test.jsx
git commit -m "feat: add AdminCommissionModal for superadmin commission dispatch and tracking"
```

---

### Task 6: Admin Accounts Panel Upgrade (`AdminAccountsPanel.jsx`)

**Files:**
- Modify: `src/components/AdminAccountsPanel.jsx`

**Interfaces:**
- Consumes: `AdminAccessModal.jsx`, `AdminCommissionModal.jsx`, `src/utils/commissions.js`, `src/utils/adminMapIcons.js`
- Produces: Upgraded admin list cards with:
  - Custom Map Icon badge & theme color
  - Commission summary chip (e.g. `Cair: Rp 150rb · Pending: Rp 50rb`)
  - 4 quick action buttons: [Akses], [Komisi], [Device], [Hapus]

- [ ] **Step 1: Update AdminAccountsPanel with commission trigger and map badge**

In `src/components/AdminAccountsPanel.jsx`:
- Import `AdminCommissionModal`, `calculateAdminCommissions`, `MAP_ICON_TYPES`, `normalizeAdminAccess`
- Add state `const [commissionAdmin, setCommissionAdmin] = useState(null);`
- In admin card render:
  - Show mini map icon representation with admin's chosen color/type
  - Calculate commission summary for non-superadmin accounts
  - Add `Komisi` button alongside `Akses`, `Device`, `Hapus`
  - Render `AdminCommissionModal` when `commissionAdmin` is active

- [ ] **Step 2: Run all tests to ensure no regressions**

Run: `npx vitest run src/utils/__tests__/adminAccounts.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminAccountsPanel.jsx
git commit -m "feat: upgrade AdminAccountsPanel with commission management and map badge display"
```

---

### Task 7: Admin Dashboard Commission Card & Payout History (`Dashboard.jsx`)

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Test: `src/pages/__tests__/DashboardCommission.test.jsx`

**Interfaces:**
- Consumes: `src/utils/commissions.js` (`calculateAdminCommissions`), `src/utils/format.js` (`formatRupiah`), `src/utils/permissions.js`
- Produces: Enhanced "Jasa & Komisi Kasir" card on Admin Dashboard with:
  - Total Komisi Diterima (Sudah Cair)
  - Komisi Berjalan (Menunggu Pencairan)
  - Modal / Card riwayat transfer komisi dengan tanggal, jam, nominal hijau, pengirim, dan metode pembayaran.

- [ ] **Step 1: Write unit test for Dashboard commission display**

Create `src/pages/__tests__/DashboardCommission.test.jsx`:
```javascript
import { describe, it, expect } from 'vitest';
import { calculateAdminCommissions } from '../../utils/commissions';

describe('Dashboard Commission Integration', () => {
  it('computes commission data correctly for current session admin', () => {
    const transactions = [
      { id: '1', status: 'LUNAS', type: 'retail', price: 100000, cashier_id: 'adm-current' }
    ];
    const history = [
      { id: 'c1', amount: 10000, status: 'TERKIRIM', notes: 'Gaji Komisi', sent_at: new Date().toISOString() }
    ];

    const data = calculateAdminCommissions(transactions, 'adm-current', 'Kasir Saya', 10000, history);
    expect(data.totalEarned).toBe(10000);
    expect(data.totalPaid).toBe(10000);
    expect(data.pendingBalance).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/pages/__tests__/DashboardCommission.test.jsx`
Expected: PASS.

- [ ] **Step 3: Update Dashboard.jsx to display commission card & payout history**

In `src/pages/Dashboard.jsx`:
- Import `calculateAdminCommissions` from `../utils/commissions` and `normalizeAdminAccess` from `../utils/permissions`
- Retrieve `myCommissions` from `session?.profile?.allowed_paths`
- Calculate `totalEarned`, `totalPaid`, and `pendingBalance`
- In place of static "Jasa Admin", render the upgraded interactive card:
  - Shows total earned, already paid, and pending balance
  - Interactive "Lihat Riwayat Pencairan" modal/accordion showing transfer history from Superadmin

- [ ] **Step 4: Run Dashboard tests**

Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/__tests__/DashboardCommission.test.jsx
git commit -m "feat: enhance dashboard with admin commission card and payout history"
```

---

### Task 8: Settings Profile Map Marker Editor (`Settings.jsx`)

**Files:**
- Modify: `src/pages/Settings.jsx`

**Interfaces:**
- Consumes: `src/utils/adminMapIcons.js` (`MAP_ICON_TYPES`, `MAP_ICON_COLORS`, `getInitials`, `getDeterministicColor`), `src/utils/permissions.js`
- Produces: Live Preview Map Marker editor under "Profil Akun Saya" in the Settings "Umum" tab.
  - Allows current admin to pick vehicle/role type (7 options)
  - Allows color selection (8 theme colors)
  - Allows custom initials / short label
  - Live interactive preview of the marker badge with pulse animation and name tag
  - Persists directly to `admin_profiles.allowed_paths.map_icon` via Supabase update

- [ ] **Step 1: Implement Live Preview Map Marker editor in Settings.jsx**

In `src/pages/Settings.jsx`:
- Import `MAP_ICON_TYPES`, `MAP_ICON_COLORS`, `getDeterministicColor`, `getInitials` from `../utils/adminMapIcons`
- Load current admin's `map_icon` from `session?.profile?.allowed_paths`
- Add controls to select type, color, and initials
- Render the Live Preview card matching the map's floating disc badge
- Implement `saveMapIcon` handler to save to `admin_profiles`

- [ ] **Step 2: Run Settings / Tab tests**

Run: `npx vitest run src/pages/__tests__/PageTabPersistence.test.jsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "feat: add live preview map marker editor to admin profile in settings"
```

---

### Task 9: Database Migration Script (`supabase_admin_commissions.sql`)

**Files:**
- Create: `supabase_admin_commissions.sql`

**Interfaces:**
- Consumes: PostgreSQL / Supabase
- Produces: Production SQL migration for `admin_commissions` table, index, and RLS policies.

- [ ] **Step 1: Write supabase_admin_commissions.sql**

Create `supabase_admin_commissions.sql`:
```sql
-- Migrasi: Tabel Relasional Riwayat Komisi Admin
-- Catatan: Sistem KAsir tetap berjalan via hybrid JSONB admin_profiles.allowed_paths
-- Tabel ini adalah pendamping relasional untuk reporting enterprise dan audit trail.

create table if not exists admin_commissions (
  id text primary key,
  admin_id uuid not null references admin_profiles(id) on delete cascade,
  admin_name text not null,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'Transfer Bank',
  notes text,
  status text not null default 'TERKIRIM',
  sent_by_name text not null default 'Super Admin',
  sent_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Index performa pencarian komisi per-admin dan per-tanggal
create index if not exists idx_admin_commissions_admin_id on admin_commissions(admin_id);
create index if not exists idx_admin_commissions_sent_at on admin_commissions(sent_at desc);

-- Aktifkan Row Level Security (RLS)
alter table admin_commissions enable row level security;

-- Policy: Admin hanya bisa melihat komisi miliknya sendiri
create policy "Admin can view own commissions"
  on admin_commissions for select
  using (
    auth.uid() = admin_id or
    exists (
      select 1 from admin_profiles
      where admin_profiles.id = auth.uid() and admin_profiles.role = 'superadmin'
    )
  );

-- Policy: Super Admin berhak insert dan update komisi
create policy "Superadmin can manage commissions"
  on admin_commissions for all
  using (
    exists (
      select 1 from admin_profiles
      where admin_profiles.id = auth.uid() and admin_profiles.role = 'superadmin'
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase_admin_commissions.sql
git commit -m "feat: add sql migration for enterprise admin commissions table"
```

---

### Task 10: Full Regression Test & Build Verification

**Files:**
- Run all vitest unit tests
- Run production build

- [ ] **Step 1: Run complete vitest test suite**

Run: `npm run test:run`
Expected: All test suites PASS (53+ test files, 450+ tests).

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Clean build without errors, serverless functions in `api/` <= 12 files.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify full regression and production build for admin features"
```

