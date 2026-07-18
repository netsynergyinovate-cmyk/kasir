# Dashboard Revenue Chart + Expandable Payment Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6-month revenue bar chart to the Dashboard, and add a 5-item cap + "Lihat Selengkapnya" expand control to the existing Sudah Bayar / Belum Bayar customer lists. No existing Dashboard feature is removed or changed in behavior.

**Architecture:** A new presentational component `RevenueBarChart` renders a static SVG bar chart from a `data` prop (array of `{ label, value }`). `Dashboard.jsx` derives 6 months of gross-revenue data ending at the selected period, adds two new `useState` booleans for per-tab list expansion, and renders the new chart section plus the updated list-with-expand markup. A new `formatRupiahCompact` helper in `src/utils/format.js` produces short value labels (`150rb`, `1,2jt`) for the bar chart, since the existing `formatRupiah` output is too wide for narrow bars.

**Tech Stack:** React, Tailwind CSS, Lucide React (existing stack only — no new npm packages).

## Global Constraints

- No new npm dependencies (per spec §"Overview" — bar chart is hand-rolled SVG, same approach as the existing `PaymentStatusDonut`).
- Bar color is flat, single hue `#2563eb` (Tailwind `blue-600`) for every bar — never varied per bar (that would redundantly re-encode the height, see spec §3.3).
- This project has no automated test runner (`package.json` has no `test` script). Verification is: `npm run lint` after each code change, a `react-dom/server` render-and-assert check with mock data (same technique used for the prior payment-status feature), and a final `npm run build`, followed by a note to the user that real-browser confirmation is still needed (the app requires live Supabase login this agent doesn't have credentials for).
- Nothing in `src/pages/Dashboard.jsx`'s existing Metrics Grid, Payment Status donut/tabs (structure), Latest Highlight, or paginated History list changes in behavior — only new code is inserted, and the payment-status list rendering is modified only to add the 5-item cap/expand, not to change what it shows.

---

### Task 1: Add `formatRupiahCompact` helper

**Files:**
- Modify: `src/utils/format.js`

**Interfaces:**
- Produces: `formatRupiahCompact(angka: number) => string` — named export. `1200000` → `"1,2jt"`; `150000` → `"150rb"`; `800` → `"800"`; `0`/`null`/`undefined` → `"0"`.

- [ ] **Step 1: Add the function**

In `src/utils/format.js`, after the existing `formatRupiah` export, add:

```javascript
export const formatRupiahCompact = (angka) => {
  if (angka === null || angka === undefined) return '0';
  const value = Math.floor(angka);
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.', ',')}jt`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}rb`;
  }
  return `${value}`;
};
```

- [ ] **Step 2: Verify with a quick manual check**

Run:
```bash
node -e "
const { formatRupiahCompact } = require('./src/utils/format.js');
" 2>&1 || echo "expected: ESM syntax error is fine, file uses export const — verify by reading the diff instead"
```
Since this file uses ES module `export` syntax (matches the rest of the codebase, e.g. `formatRupiah`), a direct `node -e require(...)` won't work — that's expected. Instead verify by inspection: re-read the edited function and confirm `1200000 → "1,2jt"`, `150000 → "150rb"`, `800 → "800"` by manual trace of the logic (no runtime check needed for a 6-line pure function; Task 5 exercises it for real through the render check).

- [ ] **Step 3: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/utils/format.js`.

- [ ] **Step 4: Commit**

```bash
git add src/utils/format.js
git commit -m "feat: add formatRupiahCompact helper for chart labels"
```

---

### Task 2: Create `RevenueBarChart` component

**Files:**
- Create: `src/components/RevenueBarChart.jsx`

**Interfaces:**
- Consumes: `formatRupiahCompact` from `../utils/format` (Task 1).
- Produces: `RevenueBarChart` — default export, React component, prop `{ data: Array<{ label: string, value: number }> }`. Renders an SVG bar chart with one bar per entry, in the array's given order (caller controls chronological order). Assumes `data.length >= 1`.

- [ ] **Step 1: Write the component**

```jsx
// src/components/RevenueBarChart.jsx
import React from 'react';
import { formatRupiahCompact } from '../utils/format';

const RevenueBarChart = ({ data }) => {
  const width = 300;
  const height = 100;
  const barGap = 8;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <svg viewBox={`0 0 ${width} ${height + 34}`} className="w-full" style={{ height: 'auto' }}>
      <title>Pendapatan kotor per bulan, 6 bulan terakhir</title>
      {data.map((item, idx) => {
        const barHeight = Math.max(Math.round((item.value / maxValue) * height), 2);
        const x = idx * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <g key={idx}>
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="9"
              fontWeight="700"
            >
              {formatRupiahCompact(item.value)}
            </text>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} fill="#2563eb" />
            <text
              x={x + barWidth / 2}
              y={height + 18}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="9"
              fontWeight="700"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default RevenueBarChart;
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/components/RevenueBarChart.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/RevenueBarChart.jsx
git commit -m "feat: add RevenueBarChart component"
```

---

### Task 3: Add 6-month revenue data derivation and render the chart section in Dashboard.jsx

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `RevenueBarChart` (Task 2), `transactions` (prop), `months` (existing local const), `selectedMonth`/`selectedYear` (existing state).
- Produces: `revenueChartData` (array of 6 `{ label, value }` objects, oldest to newest, last entry is the selected month) — used only within this file's JSX.

- [ ] **Step 1: Import the new component**

Find:

```javascript
import { formatRupiah } from '../utils/format';
import PaymentStatusDonut from '../components/PaymentStatusDonut';
import './Dashboard.css';
```

Replace with:

```javascript
import { formatRupiah } from '../utils/format';
import PaymentStatusDonut from '../components/PaymentStatusDonut';
import RevenueBarChart from '../components/RevenueBarChart';
import './Dashboard.css';
```

- [ ] **Step 2: Add the 6-month revenue derivation**

Find (the block just before the `return (` statement):

```javascript
  const totalPages = Math.ceil(listTransactions.length / itemsPerPage);
  const paginatedTrx = listTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
```

Replace with:

```javascript
  const totalPages = Math.ceil(listTransactions.length / itemsPerPage);
  const paginatedTrx = listTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Revenue trend: 6 months ending at the selected month/year (gross revenue, same definition as "Total Kotor")
  const revenueChartData = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const monthDate = new Date(selectedYear, selectedMonth - offset, 1);
    const monthIndex = monthDate.getMonth();
    const yearForMonth = monthDate.getFullYear();

    const monthRevenue = transactions
      .filter(trx => {
        const trxDate = new Date(trx.date);
        return trxDate.getMonth() === monthIndex && trxDate.getFullYear() === yearForMonth;
      })
      .reduce((acc, curr) => acc + curr.price, 0);

    return { label: months[monthIndex].slice(0, 3), value: monthRevenue };
  });

  return (
```

- [ ] **Step 3: Render the chart section**

Find:

```javascript
      </div>

      {/* Payment Status Section */}
```

Replace with:

```javascript
      </div>

      {/* Revenue Chart Section */}
      <div>
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Pendapatan 6 Bulan Terakhir</h2>
        <div className="bg-white p-5 super-rounded border border-gray-100 shadow-sm">
          <RevenueBarChart data={revenueChartData} />
        </div>
      </div>

      {/* Payment Status Section */}
```

- [ ] **Step 4: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/pages/Dashboard.jsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: add 6-month revenue bar chart to dashboard"
```

---

### Task 4: Add expand/collapse to the Sudah Bayar / Belum Bayar lists

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `activePaymentTab`, `paidCustomers`, `unpaidCustomers` (existing, Task 2 of the prior plan).
- Produces: `unpaidExpanded`, `paidExpanded` (state, booleans, default `false`) — local to this file.

- [ ] **Step 1: Add expand state**

Find:

```javascript
  const [activePaymentTab, setActivePaymentTab] = useState('unpaid');
```

Replace with:

```javascript
  const [activePaymentTab, setActivePaymentTab] = useState('unpaid');
  const [unpaidExpanded, setUnpaidExpanded] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
```

- [ ] **Step 2: Replace the list rendering with capped + expandable version**

Find:

```javascript
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
```

Replace with:

```javascript
              {(() => {
                const activeList = activePaymentTab === 'unpaid' ? unpaidCustomers : paidCustomers;
                const isExpanded = activePaymentTab === 'unpaid' ? unpaidExpanded : paidExpanded;
                const visibleList = isExpanded ? activeList : activeList.slice(0, 5);
                const toggleExpanded = () => {
                  if (activePaymentTab === 'unpaid') setUnpaidExpanded(v => !v);
                  else setPaidExpanded(v => !v);
                };

                return (
                  <div className="space-y-2">
                    {activeList.length > 0 ? (
                      visibleList.map(cust => (
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

                    {activeList.length > 5 && (
                      <button
                        onClick={toggleExpanded}
                        className="w-full text-center text-[10px] font-bold text-blue-600 mt-2 py-1.5 hover:underline"
                      >
                        {isExpanded ? 'Tutup' : `Lihat Selengkapnya (${activeList.length - 5})`}
                      </button>
                    )}
                  </div>
                );
              })()}
```

- [ ] **Step 3: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/pages/Dashboard.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: add expand/collapse to payment status customer lists"
```

---

### Task 5: Verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: Build completes with no errors.

- [ ] **Step 2: Render-and-assert check with mock data**

Using the same technique as the prior payment-status feature (a `vite build --lib` bundle of `Dashboard.jsx` loaded in Node and rendered via `react-dom/server` wrapped in `MemoryRouter`, with representative mock `customers`/`transactions` spanning at least 7 months and more than 5 unpaid customers), assert:
1. The bundle renders without throwing, for both a `selectedMonth`/`selectedYear` with data and one with none.
2. Output HTML contains `Pendapatan 6 Bulan Terakhir` and 6 `<rect` elements with `fill="#2563eb"`.
3. With 7+ unpaid customers in mock data, output HTML contains `Lihat Selengkapnya (` and only the first 5 unpaid customer names appear in the initial (collapsed) render — the 6th+ do not.
4. With 5 or fewer customers in a tab, output HTML does **not** contain `Lihat Selengkapnya`.
5. A month with 0 transactions produces a bar chart section with no thrown error (0-height bars, not omitted bars).

Since `RevenueBarChart` and the expand toggle are interactive/render-order concerns exercised via static markup (the toggle's post-click state can't be exercised via `renderToStaticMarkup`, which only proves the *initial* collapsed render is correct), this check proves the default (collapsed) state and data derivation are correct. The click-to-expand interaction itself is a plain `useState` toggle with no conditional logic beyond what's already covered by reading the code in Task 4 — treat that as covered by code review rather than requiring a browser automation harness for a one-line state flip.

- [ ] **Step 3: Report to user**

Note in the final summary that, as with the previous feature, full logged-in browser verification requires the user's real Supabase session — recommend they check the new chart and expand button live after this deploy, the same way they confirmed the payment-status feature.
