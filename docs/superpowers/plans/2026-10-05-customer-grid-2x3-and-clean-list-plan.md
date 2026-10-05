# Customer Grid 2x3 Layout & Clean List View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix customer name visibility in grid mode, enforce a 2x3 layout (2 across, 3 down with 6 items per page & pagination), and refine the list view into a clean, mobile-first table without horizontal overflow in `src/pages/Pelanggan.jsx`.

**Architecture:** Update `src/pages/Pelanggan.jsx` by adding customer name fallback logic and pagination state, styling grid view into strict `grid-cols-2` with 6 items per page, and redesigning the list table into a 3-column responsive layout while retaining `table` and `tbody tr` elements for test compatibility.

**Tech Stack:** React 19, Tailwind CSS v4, Lucide React icons, Vitest.

## Global Constraints
- Do NOT delete any existing customer features, modals, or capabilities.
- Customer name fallback: `cust.name || cust.customer_name || cust.customerName || cust.nama || 'Pelanggan'`.
- Grid view must strictly be 2 columns across and 3 rows down (6 items per page with sleek pagination controls).
- List view must retain `table` and `tbody tr` elements so that Vitest DOM queries pass without failure.
- All 6 tests in `src/pages/__tests__/Pelanggan.test.jsx` must pass 100%.
- Serverless function count in `api/` must stay $\le 12$ files.

---

### Task 1: Fix Customer Name Visibility & Build 2x3 Grid with Pagination

**Files:**
- Modify: `src/pages/Pelanggan.jsx`
- Test: `src/pages/__tests__/Pelanggan.test.jsx`

**Interfaces:**
- Consumes: `filteredCustomers`, `transactions`, `visitStatusById`, `role`
- Produces: 2x3 grid view (2 columns, 6 items per page), full name fallback with initial avatar, and pagination navigation bar.

- [ ] **Step 1: Check existing test status**
Run: `npx vitest run src/pages/__tests__/Pelanggan.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 2: Add pagination state and reset hook in Pelanggan.jsx**
In `src/pages/Pelanggan.jsx`:
- Define `const ITEMS_PER_PAGE = 6;`
- Add state `const [currentPage, setCurrentPage] = useState(1);`
- In `useEffect` or filter handlers, reset `setCurrentPage(1)` whenever `searchTerm`, `selectedPackage`, `activeTab`, or `sortBy` changes.
- Calculate `totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE) || 1;`
- Paginate grid list: `const paginatedGridCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);`

- [ ] **Step 3: Update Grid Card rendering with Name Fallback & Clean Header**
In `src/pages/Pelanggan.jsx`:
- Change grid container to strict `grid grid-cols-2 gap-2.5 sm:gap-3`.
- Compute `const displayName = cust.name || cust.customer_name || cust.customerName || cust.nama || 'Pelanggan';`
- Place avatar initials or colored icon circle next to `displayName` with status indicator dot.
- Ensure `displayName` is prominently styled (`text-xs sm:text-sm font-bold text-gray-900 leading-snug break-words`) and not squeezed by action buttons.
- Render sleek pagination bar under the grid when `totalPages > 1`:
  - `‹ Sebelumnya` button
  - `Halaman {currentPage} dari {totalPages}`
  - `Selanjutnya ›` button

- [ ] **Step 4: Run Vitest for Pelanggan page**
Run: `npx vitest run src/pages/__tests__/Pelanggan.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**
```bash
git add src/pages/Pelanggan.jsx
git commit -m "feat(pelanggan): customer name fallback and 2x3 grid with pagination"
```

---

### Task 2: Refactor List View into Clean Mobile-First Table

**Files:**
- Modify: `src/pages/Pelanggan.jsx`
- Test: `src/pages/__tests__/Pelanggan.test.jsx`

**Interfaces:**
- Consumes: `filteredCustomers`, `transactions`, `visitStatusById`
- Produces: Clean, neat table with 3 mobile-optimized columns, no horizontal overflow, and accessible action buttons.

- [ ] **Step 1: Refactor Table columns and row layout**
In `src/pages/Pelanggan.jsx`:
- Keep `<table>`, `<thead>`, and `<tbody className="divide-y divide-gray-100">`.
- Update `<thead>` to 3 columns:
  - `<th className="py-2.5 px-3">Pelanggan & Paket</th>`
  - `<th className="py-2.5 px-2.5">Tagihan & Status</th>`
  - `<th className="py-2.5 px-3 text-right">Aksi</th>`
- Update `<tr onClick={() => setSelectedDetailCust(cust)}>`:
  - Column 1: Avatar initials + `displayName` (font-bold) + nickname + package name / PPPoE badge.
  - Column 2: Nominal price (`formatRupiah(cust.price)` in emerald), status badge (Lunas/Belum Bayar), due date.
  - Column 3: Quick Pay button (`Bayar`), WhatsApp button, and detail info button.
- Eliminate horizontal overflow; all columns fit cleanly within `max-w-md`.

- [ ] **Step 2: Run Vitest to verify table tests and row click interactions**
Run: `npx vitest run src/pages/__tests__/Pelanggan.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 3: Commit**
```bash
git add src/pages/Pelanggan.jsx
git commit -m "refactor(pelanggan): clean mobile-first table for list view"
```

---

### Task 3: Full Regression Testing & Production Build

**Files:**
- Test: All 56 test files
- Build: `npm run build`

- [ ] **Step 1: Run full Vitest regression suite**
Run: `npx vitest run`
Expected: 56 files passed, 476+ tests passed.

- [ ] **Step 2: Run production build**
Run: `npm run build`
Expected: Build successfully in ~2s, 0 errors.

- [ ] **Step 3: Verify serverless functions in api/**
Confirm `api/` directory has $\le 12$ files.
