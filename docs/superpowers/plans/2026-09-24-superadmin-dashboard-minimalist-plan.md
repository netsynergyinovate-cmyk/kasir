# Minimalist Executive Hub & Folder Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `src/pages/DashboardSuperadmin.jsx` into a minimalist, high-density, professional executive interface by eliminating duplicate metrics, scaling down oversized elements, organizing quick actions into a folder-tabbed navigation dock, and preserving all commission rules and tests.

**Architecture:** Rework `DashboardSuperadmin.jsx` presentation components: replace the oversized dark Hero with a slim clean header bar (no duplicate metrics), scale the Financial Hub into a compact 4-metric grid, wrap quick actions in an interactive folder-style navigation dock with category tabs, and tighten proportions of the lower charts and leaderboards.

**Tech Stack:** React 19, Tailwind CSS, Lucide React icons, React Router DOM, Vitest.

## Global Constraints
- Do NOT delete any existing features or components.
- Superadmin commission must remain Rp 0; CS commission must remain Rp 0.
- Admin Wahyu must receive Rp 130.000 commission.
- Multi-admin independence must remain supported.
- `DashboardSuperadmin.test.jsx` all 9 tests must pass without any assertion failures.
- Serverless function count in `api/` must stay $\le 12$ files.

---

### Task 1: Refactor Hero Header into Slim Minimalist Executive Header

**Files:**
- Modify: `src/pages/DashboardSuperadmin.jsx:125-165`
- Test: `src/pages/__tests__/DashboardSuperadmin.test.jsx`

**Interfaces:**
- Consumes: `displayName`, `currentDate`, `effectiveAccounts`
- Produces: Slim header bar with greeting, role badge, live system indicator; NO duplicate metric tiles.

- [x] **Step 1: Check existing test status**
Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS (9 tests)

- [x] **Step 2: Replace oversized dark hero with slim executive header**
Replace the bulky dark hero block in `src/pages/DashboardSuperadmin.jsx`:
- Keep `Halo, {displayName}` and subtitle.
- Keep the live system indicator badge.
- Remove the 4 duplicate metric tiles (`Hari Ini`, `Bulan Berjalan`, `Laba Bersih Est.`, `Admin Kasir`).
- Style with a clean, low-profile executive card (`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm`).

- [x] **Step 3: Run Vitest to verify greeting tests pass**
Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS (9 tests)

- [x] **Step 4: Commit**
```bash
git add src/pages/DashboardSuperadmin.jsx
git commit -m "refactor(dashboard-superadmin): slim minimalist executive header without duplicate metrics"
```

---

### Task 2: Refactor Financial Hub into Compact High-Density Metric Grid

**Files:**
- Modify: `src/pages/DashboardSuperadmin.jsx:165-275`
- Test: `src/pages/__tests__/DashboardSuperadmin.test.jsx`

**Interfaces:**
- Consumes: `financialOverview`, `comparison`, `companyInfo`, `effectiveAccounts`
- Produces: 4 compact metric cards with proportional typography, subtle borders, and precise accounting details.

- [ ] **Step 1: Scale down financial cards and typography**
In `src/pages/DashboardSuperadmin.jsx`:
- Scale card container padding from `p-4` to `p-3 sm:p-3.5`.
- Scale nominal numbers from `text-xl sm:text-2xl font-black` to `text-lg sm:text-xl font-bold text-slate-900`.
- Maintain required labels:
  - Card 1: `Omset Kotor Toko` + `Total Kotor`
  - Card 2: `Hak Komisi Kasir` + rate `/trx`
  - Card 3: `Komisi Dicairkan` + pending status badge
  - Card 4: `Laba Bersih Toko` + `Margin Toko`
- Use subtle top accent lines (2px) and compact badge pills (`text-[9px]`).

- [ ] **Step 2: Run Vitest to verify financial tokens are present**
Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS (9 tests)

- [ ] **Step 3: Commit**
```bash
git add src/pages/DashboardSuperadmin.jsx
git commit -m "refactor(dashboard-superadmin): compact high-density financial metrics grid"
```

---

### Task 3: Build Folder-Tabbed Quick Action Navigation Dock

**Files:**
- Modify: `src/pages/DashboardSuperadmin.jsx:275-365`
- Test: `src/pages/__tests__/DashboardSuperadmin.test.jsx`

**Interfaces:**
- Consumes: Navigation links `/pos`, `/customers`, `/rute`, `/settings`, commission modal trigger
- Produces: Folder-style quick actions panel with category tabs (`Semua`, `Operasional`, `Finansial`, `Sistem`) and compact action buttons without text truncation.

- [ ] **Step 1: Add folder category state and structure**
In `src/pages/DashboardSuperadmin.jsx`:
- Add state `activeNavFolder` (`'all' | 'ops' | 'finance' | 'system'`).
- Build folder binder container with tabs:
  - 📁 Semua Menu
  - 📁 Operasional (`Kasir Baru`, `Pelanggan`)
  - 📁 Finansial (`Kelola Komisi`, `WA Tagihan`)
  - 📁 Sistem & Rute (`Rute & Live`, `Pengaturan`)
- Render buttons in a neat, responsive grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-6`) with compact icons (size 16-18), clean labels, and badges.
- Ensure all 6 required texts exist: `Kasir Baru`, `Pelanggan`, `Kelola Komisi`, `Rute &amp; Live`, `WA Tagihan`, `Pengaturan`.

- [ ] **Step 2: Run Vitest to verify quick action assertions**
Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS (9 tests)

- [ ] **Step 3: Commit**
```bash
git add src/pages/DashboardSuperadmin.jsx
git commit -m "feat(dashboard-superadmin): folder-tabbed quick action navigation dock"
```

---

### Task 4: Rescale & Refine Lower Sections (Pendapatan, Omset, Kasir, Audit)

**Files:**
- Modify: `src/pages/DashboardSuperadmin.jsx:365-830`
- Test: `src/pages/__tests__/DashboardSuperadmin.test.jsx`

**Interfaces:**
- Consumes: `dailyTransactions`, `dayComparison`, `weeklyChartData`, `kpiMetrics`, `sortedCashiers`, `adminLogins`
- Produces: Compact, proportional, minimalist cards for daily revenue, weekly chart, monthly KPI, cashier podium, and login audit.

- [ ] **Step 1: Rescale lower sections for high information density**
In `src/pages/DashboardSuperadmin.jsx`:
- Pendapatan Harian: Compact segmented toggle pill (`Hari Ini`, `Kemarin`, `Pilih Tanggal`), compact hero highlight card, compact buku kas rows.
- Omset 7 Hari: Clean bar chart (`h-24 sm:h-28`), compact bar labels.
- KPI Bulanan: Clean horizontal progress bars.
- Performa Kasir: Compact podium badges (#1, #2, #3), sleek commission pill, `[Transfer Komisi]` compact button.
- Aktivitas Login: Compact single-line security audit feed.

- [ ] **Step 2: Run Vitest for DashboardSuperadmin**
Run: `npx vitest run src/pages/__tests__/DashboardSuperadmin.test.jsx`
Expected: PASS (9 tests)

- [ ] **Step 3: Commit**
```bash
git add src/pages/DashboardSuperadmin.jsx
git commit -m "refactor(dashboard-superadmin): rescale lower sections for compact minimalist presentation"
```

---

### Task 5: Full Regression Testing & Production Build

**Files:**
- Test: All 56 test files
- Build: `npm run build`

- [ ] **Step 1: Run full Vitest regression suite**
Run: `npx vitest run`
Expected: 56 files passed, 476 tests passed.

- [ ] **Step 2: Run production build**
Run: `npm run build`
Expected: Build successfully in ~2s, 0 errors.

- [ ] **Step 3: Final check of API serverless functions**
Verify `api/` directory has $\le 12$ files.
