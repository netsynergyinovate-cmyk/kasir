# Upgrade Dashboard Superadmin & Penyempurnaan Sistem Komisi Kasir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengembangkan antarmuka Dashboard Superadmin menjadi Executive Command Center profesional dengan Ringkasan Finansial Toko, Quick Actions, Direct Commission Transfer trigger, dan aturan atribusi komisi presisi (Superadmin & CS = Rp 0, Admin Wahyu = Rp 130.000, serta dukungan multi-admin independen).

**Architecture:** Memperluas kalkulasi di `commissions.js` dan `dashboardStats.js` untuk mengisolasi peran non-komisi (Superadmin & CS) dan mengalokasikan transaksi kasir toko ke Admin Wahyu secara otomatis. Mengupgrade `DashboardSuperadmin.jsx` dengan komponen ringkasan finansial eksekutif, tombol aksi transfer komisi langsung per-kasir, dan pintasan cepat tanpa merusak atau menghapus satupun fitur eksisting.

**Tech Stack:** React 19, Tailwind CSS v4, Lucide Icons, Vitest, Supabase Client.

## Global Constraints
- Semua fitur eksisting di Dashboard Superadmin (Hero sapaan, Pendapatan harian + buku kas, grafik 7 hari, KPI bulan, aktivitas login, dan rute/transaksi detail di bawah) WAJIB tetap utuh dan berfungsi 100%.
- Superadmin dan kanal CS tidak pernah mendapatkan komisi (Rp 0).
- Format mata uang selalu menggunakan `formatRupiah` dari `src/utils/format.js`.
- Semua teks user-facing menggunakan Bahasa Indonesia yang formal dan profesional.
- File serverless functions di `api/` tetap $\le 12$ file.

---

### Task 1: Commission Engine Rule Updates (Non-Komisi Superadmin/CS & Atribusi Wahyu)

**Files:**
- Modify: `src/utils/commissions.js`
- Test: `src/utils/__tests__/commissions.test.js`

**Interfaces:**
- Consumes: `transactions`, `adminId`, `adminName`, `adminRole`, `adminFee`, `commissionHistory`
- Produces: `calculateAdminCommissions(transactions, adminId, adminName, adminFee, commissionHistory, adminRole)`

- [ ] **Step 1: Write unit tests in `src/utils/__tests__/commissions.test.js` for role-based rules**

```javascript
describe('calculateAdminCommissions with role and CS exclusion', () => {
  it('returns 0 commission for superadmin role regardless of transactions', () => {
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', price: 100000, cashier_name: 'Super Admin' }
    ];
    const result = calculateAdminCommissions(transactions, 'super-1', 'Super Admin', 10000, [], 'superadmin');
    expect(result.totalEarned).toBe(0);
    expect(result.pendingBalance).toBe(0);
  });

  it('excludes CS transactions from commission calculation', () => {
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', price: 100000, payment_method: 'CS', cashier_name: 'Wahyu' },
      { id: 't2', status: 'LUNAS', type: 'retail', price: 100000, payment_method: 'CASH', cashier_name: 'Wahyu' }
    ];
    const result = calculateAdminCommissions(transactions, 'adm-wahyu', 'Wahyu', 10000, [], 'admin');
    expect(result.earnedTrxCount).toBe(1);
    expect(result.totalEarned).toBe(10000);
  });

  it('attributtes general store cashier transactions to Admin Wahyu', () => {
    // 13 retail transactions without specific cashier_id or with Wahyu
    const transactions = Array.from({ length: 13 }, (_, i) => ({
      id: `trx-${i}`,
      status: 'LUNAS',
      type: 'retail',
      payment_method: 'CASH',
      cashier_name: i < 5 ? 'Wahyu' : 'Admin'
    }));
    const result = calculateAdminCommissions(transactions, 'adm-wahyu', 'Wahyu', 10000, [], 'admin');
    expect(result.earnedTrxCount).toBe(13);
    expect(result.totalEarned).toBe(130000);
    expect(result.pendingBalance).toBe(130000);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/utils/__tests__/commissions.test.js`
Expected: FAIL

- [ ] **Step 3: Update `src/utils/commissions.js` to implement role-based exclusion & Wahyu attribution**

```javascript
export function calculateAdminCommissions(
  transactions = [], 
  adminId = '', 
  adminName = '', 
  adminFee = 10000, 
  commissionHistory = [],
  adminRole = 'admin'
) {
  // Superadmin tidak pernah mendapatkan komisi
  if (adminRole === 'superadmin') {
    return {
      earnedTrxCount: 0,
      totalEarned: 0,
      totalPaid: 0,
      pendingBalance: 0,
      history: [],
    };
  }

  const isWahyu = (adminName || '').toLowerCase().includes('wahyu');

  const matchingTrx = transactions.filter((t) => {
    const isPaid = t.status === 'LUNAS' || t.type === 'instansi';
    const isCS = t.payment_method === 'CS' || 
                 (t.cashier_name || '').toLowerCase().includes('cs') ||
                 (t.cashierName || '').toLowerCase().includes('cs');
    if (!isPaid || isCS) return false;

    // Jika admin adalah Wahyu, sertakan transaksi kasir umum / toko yang belum spesifik
    if (isWahyu) {
      const isSpecificOtherAdmin = t.cashier_id && t.cashier_id !== adminId && 
                                   t.cashier_name && !t.cashier_name.toLowerCase().includes('wahyu') &&
                                   !t.cashier_name.toLowerCase().includes('admin');
      if (isSpecificOtherAdmin) return false;
      return true;
    }

    return isOwnTransaction(t, adminId, adminName);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/commissions.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/utils/commissions.js src/utils/__tests__/commissions.test.js
git commit -m "feat(commissions): enforce 0 commission for superadmin/cs and attribute general store cashier to Wahyu"
```

---

### Task 2: Store Financial & Commission Overview Helper

**Files:**
- Modify: `src/utils/commissions.js`
- Test: `src/utils/__tests__/commissions.test.js`

**Interfaces:**
- Consumes: `transactions`, `accounts`, `adminFee`, `now`
- Produces: `calculateStoreFinancialOverview(transactions, accounts, adminFee, now)`

- [ ] **Step 1: Write test for `calculateStoreFinancialOverview` in `src/utils/__tests__/commissions.test.js`**

```javascript
describe('calculateStoreFinancialOverview', () => {
  it('calculates gross revenue, total admin commission liabilities, and net profit', () => {
    const transactions = [
      { id: 't1', status: 'LUNAS', type: 'retail', price: 200000, cashier_name: 'Wahyu', date: new Date().toISOString() },
      { id: 't2', status: 'LUNAS', type: 'retail', price: 150000, payment_method: 'CS', cashier_name: 'CS', date: new Date().toISOString() },
      { id: 't3', status: 'LUNAS', type: 'retail', price: 250000, cashier_name: 'Budi', date: new Date().toISOString() },
    ];
    const accounts = [
      { id: 'adm-wahyu', full_name: 'Wahyu', role: 'admin', allowed_paths: { commissions: [{ amount: 10000, status: 'TERKIRIM' }] } },
      { id: 'adm-budi', full_name: 'Budi', role: 'admin', allowed_paths: { commissions: [] } },
      { id: 'super-1', full_name: 'Owner', role: 'superadmin' }
    ];

    const overview = calculateStoreFinancialOverview(transactions, accounts, 10000);
    expect(overview.grossRevenue).toBe(600000);
    expect(overview.totalCommissionLiability).toBe(20000); // Wahyu (1) + Budi (1), CS (0)
    expect(overview.totalCommissionPaid).toBe(10000);
    expect(overview.pendingCommissionBalance).toBe(10000);
    expect(overview.netStoreProfit).toBe(580000);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/utils/__tests__/commissions.test.js`
Expected: FAIL (`calculateStoreFinancialOverview is not a function`)

- [ ] **Step 3: Implement `calculateStoreFinancialOverview` in `src/utils/commissions.js`**

```javascript
export function calculateStoreFinancialOverview(transactions = [], accounts = [], adminFee = 10000, now = new Date()) {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isCurrentMonthSuccess = (t) => {
    const d = new Date(t.date);
    const inThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    const isPaid = t.status === 'LUNAS' || t.type === 'instansi';
    return inThisMonth && isPaid;
  };

  const monthlyTrx = transactions.filter(isCurrentMonthSuccess);
  const grossRevenue = monthlyTrx.reduce((sum, t) => sum + Number(t.price || 0), 0);

  // Hitung komisi untuk seluruh admin (kecuali superadmin)
  let totalCommissionLiability = 0;
  let totalCommissionPaid = 0;

  const adminAccounts = accounts.filter(a => a.role !== 'superadmin');
  adminAccounts.forEach(admin => {
    const access = normalizeAdminAccess(admin.allowed_paths);
    const comm = calculateAdminCommissions(
      monthlyTrx, 
      admin.id, 
      admin.full_name, 
      adminFee, 
      access.commissions || [],
      admin.role
    );
    totalCommissionLiability += comm.totalEarned;
    totalCommissionPaid += comm.totalPaid;
  });

  const pendingCommissionBalance = Math.max(0, totalCommissionLiability - totalCommissionPaid);
  const netStoreProfit = Math.max(0, grossRevenue - totalCommissionLiability);

  return {
    grossRevenue,
    totalCommissionLiability,
    totalCommissionPaid,
    pendingCommissionBalance,
    netStoreProfit,
    activeAdminCount: adminAccounts.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/commissions.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/utils/commissions.js src/utils/__tests__/commissions.test.js
git commit -m "feat(commissions): add calculateStoreFinancialOverview for executive dashboard summary"
```

---

### Task 3: DashboardSuperadmin UI - Executive Financial Hub & Quick Actions

**Files:**
- Modify: `src/pages/DashboardSuperadmin.jsx`
- Test: `src/pages/__tests__/DashboardSuperadmin.test.jsx`

**Interfaces:**
- Consumes: `calculateStoreFinancialOverview`, `transactions`, `accounts`, `companyInfo`
- Produces: Executive Financial Hub cards & 6 Quick Action shortcuts in Superadmin view

- [ ] **Step 1: Check existing `DashboardSuperadmin.test.jsx` and add test for executive cards**

```javascript
it('renders executive financial overview and quick actions', () => {
  // Verifikasi render kartu omset kotor, komisi kasir, dan laba bersih
});
```

- [ ] **Step 2: Update `DashboardSuperadmin.jsx` to render Executive Financial Hub & Quick Actions**

Insert right below the Hero sapaan (lines 104-106):
1. **Executive Financial Summary (4 Cards)**:
   - 💰 **Total Omset Toko** (Bulan ini)
   - 🏷️ **Kewajiban Komisi Kasir** (Hak admin)
   - 🟢 **Sudah Cair vs 🟡 Sisa Pending**
   - 📈 **Estimasi Laba Bersih Toko**
2. **Executive Quick Actions Bar (6 Buttons)**:
   - ⚡ Kasir Baru (`/pos`)
   - 👥 Pelanggan (`/customers`)
   - 💸 Kelola Komisi Admin (state trigger untuk buka modal komisi)
   - 🗺️ Rute & Pelacakan Live (`/rute`)
   - 📲 Pengingat WA Masal (trigger Watbiz)
   - ⚙️ Pengaturan Toko (`/settings`)

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add src/pages/DashboardSuperadmin.jsx src/pages/__tests__/DashboardSuperadmin.test.jsx
git commit -m "feat(dashboard-superadmin): add executive financial hub and quick actions bar"
```

---

### Task 4: Direct Commission Transfer Trigger & Enhanced Cashier Ranking

**Files:**
- Modify: `src/pages/DashboardSuperadmin.jsx`
- Test: `src/pages/__tests__/DashboardSuperadmin.test.jsx`

**Interfaces:**
- Consumes: `AdminCommissionModal`, `admin_profiles` data, `transactions`
- Produces: Direct `[Transfer Komisi]` button per cashier and modal wiring

- [ ] **Step 1: Write test for cashier commission button and modal opening**

- [ ] **Step 2: Update `DashboardSuperadmin.jsx`**
  - Import `AdminCommissionModal` from `../components/AdminCommissionModal`.
  - Add state `const [selectedCommissionAdmin, setSelectedCommissionAdmin] = useState(null)`.
  - In Performa Kasir:
    - If `role === 'superadmin'`: Render badge `👑 Super Admin (Non-Komisi)` dan teks komisi `Rp 0`.
    - If `cashier.name` includes 'CS': Render badge `💬 Layanan CS (Non-Komisi)` dan teks komisi `Rp 0`.
    - If admin (Wahyu, dll):
      - Compute commission data via `calculateAdminCommissions`.
      - Display: `Komisi: Rp 130.000` (atau sesuai transaksi), `Cair: Rp X`, `Pending: Rp Y`.
      - Render button **`[Transfer Komisi]`** with green accent and send icon.
      - Clicking opens `AdminCommissionModal` with `selectedCommissionAdmin` set to this admin profile!
  - Render `<AdminCommissionModal />` when `selectedCommissionAdmin` is active.

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add src/pages/DashboardSuperadmin.jsx src/pages/__tests__/DashboardSuperadmin.test.jsx
git commit -m "feat(dashboard-superadmin): add direct commission transfer trigger and cashier badges"
```

---

### Task 5: Dashboard Admin Commission Sync & Realtime Verification

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Test: `src/pages/__tests__/DashboardCommission.test.jsx`

**Interfaces:**
- Consumes: `calculateAdminCommissions` with role and Wahyu attribution
- Produces: Seamless realtime commission display when Admin Wahyu or any other admin logs in

- [ ] **Step 1: Update `Dashboard.jsx`**
  - Pass `session?.profile?.role` to `calculateAdminCommissions` so superadmin receives Rp 0, while Wahyu receives the Rp 130.000 store cashier commission.
  - Verify that when Admin logs in, the "Jasa Kasir & Komisi" card accurately displays Rp 130.000.

- [ ] **Step 2: Run test to verify**

Run: `npx vitest run src/pages/__tests__/DashboardCommission.test.jsx`
Expected: PASS

- [ ] **Step 3: Commit changes**

```bash
git add src/pages/Dashboard.jsx src/pages/__tests__/DashboardCommission.test.jsx
git commit -m "feat(dashboard): ensure admin commission card reflects role rules and Wahyu store attribution"
```

---

### Task 6: Full Regression Testing & Production Build Verification

**Files:**
- All touched files

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All 56+ test files PASS, 0 failures.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build passes in < 3s, manifest & service worker generated cleanly.

- [ ] **Step 3: Verify serverless function limit**

Run: PowerShell script to count files in `api/` excluding `_lib`
Expected: $\le 12$ files.

- [ ] **Step 4: Final commit & summary update**
