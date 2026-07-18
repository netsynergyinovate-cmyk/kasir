# Dashboard Payment Status (Sudah Bayar / Belum Bayar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a donut chart and a tabbed "Sudah Bayar / Belum Bayar" customer list to the Dashboard, showing which active retail customers have paid for the currently selected month/year, with no new dependencies.

**Architecture:** A new presentational component `PaymentStatusDonut` renders a static 2-segment SVG donut from `paidCount`/`unpaidCount` props. `Dashboard.jsx` derives `activeCustomers`, `paidCustomers`, and `unpaidCustomers` from the existing `customers` and `filteredTransactions` (the latter already filtered by the page's `selectedMonth`/`selectedYear`), adds a new `activePaymentTab` state, and renders the chart + tabs + list in a new section between the Metrics Grid and the "Transaksi Barusan" highlight.

**Tech Stack:** React, Tailwind CSS, Lucide React (existing stack only — no new npm packages).

## Global Constraints

- No new npm dependencies (per spec §4 — donut chart is hand-rolled SVG).
- Status colors are fixed: green `#16a34a` (Tailwind `green-600`) = paid, orange `#f97316` (Tailwind `orange-500`) = unpaid — matches the colors already used for `LUNAS`/non-`LUNAS` badges in `src/pages/History.jsx:104`. Never used as arbitrary categorical colors, always paired with a text label.
- This project has no automated test runner configured (`package.json` has no `test` script, no test files exist). Verification steps in this plan are: `npm run lint` (catches syntax/lint errors) after each code change, plus a manual browser smoke test at the end — consistent with prior plans in `docs/superpowers/plans/2026-06-16-dashboard-upgrade.md` and `2026-06-16-dashboard-transaction-progress.md`, which used the same approach.
- Only customers with `status === 'aktif'` are considered (spec §2.1). Instansi is out of scope (spec §2.1).
- A customer is "paid" for the period if any transaction has `type === 'retail'`, `status === 'LUNAS'`, and `customerName` matching the customer's `name` (case-insensitive, trimmed) within `filteredTransactions` (spec §2.2).

---

### Task 1: Create the `PaymentStatusDonut` component

**Files:**
- Create: `src/components/PaymentStatusDonut.jsx`

**Interfaces:**
- Produces: `PaymentStatusDonut` — default export, React component, props `{ paidCount: number, unpaidCount: number }`. Renders an SVG donut (green = paid portion, orange = remaining) with a centered `{percentage}%` + `{paidCount}/{total}` label, and a legend listing "Sudah Bayar" (green swatch, count) and "Belum Bayar" (orange swatch, count). Assumes `paidCount + unpaidCount >= 1` (caller is responsible for not rendering it when both are 0 — see Task 3's empty-state handling).

- [ ] **Step 1: Write the component**

```jsx
// src/components/PaymentStatusDonut.jsx
import React from 'react';

const PaymentStatusDonut = ({ paidCount, unpaidCount }) => {
  const total = paidCount + unpaidCount;
  const size = 140;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const paidRatio = total > 0 ? paidCount / total : 0;
  const paidLength = circumference * paidRatio;
  const percentage = total > 0 ? Math.round(paidRatio * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <title>{`${paidCount} dari ${total} pelanggan aktif sudah bayar bulan ini`}</title>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f97316"
            strokeWidth={strokeWidth}
          />
          {paidCount > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#16a34a"
              strokeWidth={strokeWidth}
              strokeDasharray={`${paidLength} ${circumference - paidLength}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-black text-gray-900 leading-none">{percentage}%</p>
          <p className="text-[9px] font-bold text-gray-400 mt-1">{paidCount}/{total} Lunas</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-600 shrink-0"></span>
          <span className="text-xs font-bold text-gray-700">Sudah Bayar</span>
          <span className="text-xs font-black text-gray-900 ml-auto pl-4">{paidCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span>
          <span className="text-xs font-bold text-gray-700">Belum Bayar</span>
          <span className="text-xs font-black text-gray-900 ml-auto pl-4">{unpaidCount}</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusDonut;
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors reported for `src/components/PaymentStatusDonut.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PaymentStatusDonut.jsx
git commit -m "feat: add PaymentStatusDonut chart component"
```

---

### Task 2: Add payment-status derivation logic and tab state to Dashboard.jsx

**Files:**
- Modify: `src/pages/Dashboard.jsx:10` (state block), `src/pages/Dashboard.jsx:52` (after existing derived metrics, before `latestSuccess`)

**Interfaces:**
- Consumes: `customers` (prop, array of `{ id, name, package, status, ... }`), `filteredTransactions` (existing local const, array of `{ customerName, type, status, ... }`, already filtered by `selectedMonth`/`selectedYear` at `Dashboard.jsx:19-22`).
- Produces: `activePaymentTab` (state, `'paid' | 'unpaid'`), `setActivePaymentTab`, `activeCustomers`, `paidCustomers`, `unpaidCustomers` (arrays of customer objects), `totalActiveCustomers` (number) — all consumed by Task 3's JSX.

- [ ] **Step 1: Add `activePaymentTab` state**

In `src/pages/Dashboard.jsx`, find:

```javascript
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
```

Replace with:

```javascript
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [activePaymentTab, setActivePaymentTab] = useState('unpaid');
```

- [ ] **Step 2: Add payment-status derivation logic**

Find this block (the last of the existing derived-metrics consts, right before the `latestSuccess` comment):

```javascript
  const totalCustomers = customers.length;
  // Calculate percentage, ensure it doesn't exceed 100% or drop below 0, handle 0 customers
  const progressPercentage = totalCustomers > 0 
    ? Math.min(Math.round((totalSuccessTrx / totalCustomers) * 100), 100) 
    : 0;

  // Latest highlight (within filtered list)
```

Replace with:

```javascript
  const totalCustomers = customers.length;
  // Calculate percentage, ensure it doesn't exceed 100% or drop below 0, handle 0 customers
  const progressPercentage = totalCustomers > 0 
    ? Math.min(Math.round((totalSuccessTrx / totalCustomers) * 100), 100) 
    : 0;

  // Payment status breakdown (active customers only, for the selected month/year)
  const activeCustomers = customers.filter(c => c.status === 'aktif');

  const isPaidThisPeriod = (customer) => filteredTransactions.some(trx =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase()
  );

  const paidCustomers = activeCustomers.filter(isPaidThisPeriod);
  const unpaidCustomers = activeCustomers.filter(c => !isPaidThisPeriod(c));
  const totalActiveCustomers = activeCustomers.length;

  // Latest highlight (within filtered list)
```

- [ ] **Step 3: Lint check**

Run: `npm run lint`
Expected: No new errors reported for `src/pages/Dashboard.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: derive paid/unpaid active customer lists for selected period"
```

---

### Task 3: Render the payment status section in Dashboard.jsx

**Files:**
- Modify: `src/pages/Dashboard.jsx:1` (imports), `src/pages/Dashboard.jsx` (JSX, between the Metrics Grid and the Latest Highlight section)

**Interfaces:**
- Consumes: `PaymentStatusDonut` (Task 1), `activeCustomers`, `paidCustomers`, `unpaidCustomers`, `totalActiveCustomers`, `activePaymentTab`, `setActivePaymentTab` (Task 2).

- [ ] **Step 1: Import the new component**

Find:

```javascript
import { formatRupiah } from '../utils/format';
import './Dashboard.css';
```

Replace with:

```javascript
import { formatRupiah } from '../utils/format';
import PaymentStatusDonut from '../components/PaymentStatusDonut';
import './Dashboard.css';
```

- [ ] **Step 2: Insert the new section**

Find the end of the Metrics Grid and the start of the Latest Highlight section:

```javascript
      </div>

      {/* Latest Highlight */}
      {latestSuccess && (
```

Replace with (adds the new section in between, keeps the rest unchanged):

```javascript
      </div>

      {/* Payment Status Section */}
      <div>
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Status Pembayaran Bulan Ini</h2>
        <div className="bg-white p-5 super-rounded border border-gray-100 shadow-sm">
          {totalActiveCustomers > 0 ? (
            <>
              <PaymentStatusDonut paidCount={paidCustomers.length} unpaidCount={unpaidCustomers.length} />

              <div className="flex gap-2 mt-5 mb-3">
                <button
                  onClick={() => setActivePaymentTab('unpaid')}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${activePaymentTab === 'unpaid' ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-50 text-gray-500'}`}
                >
                  Belum Bayar ({unpaidCustomers.length})
                </button>
                <button
                  onClick={() => setActivePaymentTab('paid')}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${activePaymentTab === 'paid' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-50 text-gray-500'}`}
                >
                  Sudah Bayar ({paidCustomers.length})
                </button>
              </div>

              <div className="space-y-2">
                {(activePaymentTab === 'unpaid' ? unpaidCustomers : paidCustomers).length > 0 ? (
                  (activePaymentTab === 'unpaid' ? unpaidCustomers : paidCustomers).map(cust => (
                    <div key={cust.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
                      <div>
                        <p className="font-bold text-gray-800 text-xs leading-tight">{cust.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{cust.package}</p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${activePaymentTab === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {activePaymentTab === 'paid' ? 'Lunas' : 'Belum Bayar'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-400 text-xs font-medium py-6">
                    {activePaymentTab === 'unpaid' ? 'Semua pelanggan sudah bayar bulan ini 🎉' : 'Belum ada pelanggan yang membayar bulan ini'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 text-xs font-medium py-6">Belum ada pelanggan aktif</p>
          )}
        </div>
      </div>

      {/* Latest Highlight */}
      {latestSuccess && (
```

- [ ] **Step 3: Lint check**

Run: `npm run lint`
Expected: No new errors reported for `src/pages/Dashboard.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: render payment status donut chart and tabs on dashboard"
```

---

### Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite dev server starts without errors, prints a local URL.

- [ ] **Step 2: Open the app and navigate to the Dashboard**

Open the printed local URL in a browser, log in if needed, and land on the Dashboard page (default route).

- [ ] **Step 3: Verify the new section renders**

Check:
1. A "Status Pembayaran Bulan Ini" card appears between the 4 metric cards and the "Transaksi Barusan 🔥" highlight (or where the highlight would be).
2. The donut chart shows a green/orange split with a `{percentage}%` and `{paid}/{total}` center label, plus a legend with counts.
3. The "Belum Bayar (N)" tab is selected by default; clicking "Sudah Bayar (N)" switches the list and highlights that tab instead.
4. Each row shows a customer name, package, and a colored badge matching the active tab.

- [ ] **Step 4: Verify the month/year filter drives it**

Change the month/year dropdowns in the "Periode" filter at the top of the Dashboard. Confirm the donut percentages, tab counts, and list contents update to match the newly selected period (customers who paid in the new period move to "Sudah Bayar", others to "Belum Bayar").

- [ ] **Step 5: Verify empty states**

If there is a month/year with 0 active customers or 0 members in one of the tabs, confirm the friendly empty-state message renders instead of an empty list (per spec §3.2). If test data doesn't naturally produce this, temporarily filter to a month/year with no transactions to confirm the "Belum ada pelanggan yang membayar bulan ini" message appears for the "Sudah Bayar" tab.

- [ ] **Step 6: Run the production build**

Run: `npm run build`
Expected: Build completes with no errors.
