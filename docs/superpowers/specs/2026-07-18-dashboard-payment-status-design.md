# Design Spec: Dashboard Payment Status (Sudah Bayar / Belum Bayar) + Donut Chart

**Date:** 2026-07-18
**Status:** Approved
**Topic:** Adding a paid/unpaid customer breakdown and a status donut chart to the Dashboard, driven by the existing month/year filter.

## 1. Overview

Admins currently have no quick way to see, for the selected billing period, which active retail customers have already paid and which haven't. This feature adds:

1. A per-customer paid/unpaid breakdown for the currently selected month/year (reusing the existing `selectedMonth`/`selectedYear` filter already on the Dashboard).
2. A donut chart visualizing the paid vs. unpaid proportion for that period.
3. A tabbed list ("Sudah Bayar" / "Belum Bayar") so an admin can see exactly which customers still need collecting.

No new dependencies, no database schema changes. Everything is derived client-side from data already loaded in `Dashboard.jsx` (`customers`, `transactions`).

## 2. Data Logic

### 2.1 Scope
- Only customers from the `customers` table (retail). Instansi is a separate entity/flow and is out of scope.
- Only customers whose `status === 'aktif'` are considered. Non-active customers are not billed and are excluded from both lists and the chart's denominator.

### 2.2 Paid/unpaid determination
For the currently selected `selectedMonth` / `selectedYear` (same state already used for the rest of the Dashboard's metrics):

A customer counts as **paid** for the period if there exists at least one transaction in `transactions` where:
- `type === 'retail'`
- `status === 'LUNAS'`
- `customerName` matches the customer's `name` (case-insensitive, trimmed compare — matches existing name-based association used elsewhere, e.g. `History.jsx`)
- the transaction's `date` falls within the selected month and year

Otherwise the customer counts as **unpaid** for the period.

This mirrors the filtering pattern already used for `filteredTransactions` (Dashboard.jsx:19-22) — no new filtering primitive needed, just a per-customer lookup against that same filtered set.

### 2.3 Derived values
- `activeCustomers` = `customers.filter(c => c.status === 'aktif')`
- `paidCustomers` = active customers with a matching LUNAS transaction this period
- `unpaidCustomers` = active customers without one
- `paidCount` / `unpaidCount` / `totalActive` = lengths of the above, for the chart and tab labels

## 3. UI

### 3.1 Placement
New section inserted in `Dashboard.jsx`, directly **after the Metrics Grid** and **before "Transaksi Barusan"** (the latest-success highlight). This keeps it adjacent to the period filter and the existing billing metrics it's derived from.

### 3.2 Structure
- Section heading: "Status Pembayaran Bulan Ini" (small uppercase label, matching existing section heading style, e.g. `text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]`).
- Donut chart (see §4) with a centered figure showing `paidCount / totalActive` and a legend below/beside it: a green swatch + "Sudah Bayar (N)" and an orange swatch + "Belum Bayar (N)".
- Below the chart: two tab buttons, "Sudah Bayar (N)" and "Belum Bayar (N)", styled consistently with other pill/tab controls in the app. Selecting a tab shows that list.
- List rows: customer `name`, `package`, and (unpaid tab only) a small orange badge, matching the visual language of existing badges (`bg-orange-100 text-orange-700` as used in `History.jsx:104`). Paid tab rows use the green equivalent (`bg-green-100 text-green-700`).
- Rows are not clickable (no navigation or WhatsApp action) — display-only, to keep scope minimal per this round.
- Empty states:
  - `totalActive === 0`: show a single friendly empty message instead of the whole section content ("Belum ada pelanggan aktif").
  - A tab with 0 items: show a small empty message within that tab ("Semua pelanggan sudah bayar bulan ini 🎉" / "Belum ada pelanggan yang membayar bulan ini").

### 3.3 State
- `activePaymentTab` — new `useState`, `'paid' | 'unpaid'`, default `'unpaid'` (the more actionable view — admins open the dashboard specifically to see who still owes).

## 4. Donut Chart

- Custom inline SVG, no charting library — this is a single static 2-segment chart, and the project has zero chart dependencies today.
- Two arcs: paid (green, `#16a34a` / `stroke-green-600` — same green already used for the "LUNAS" badge and the highlight-card checkmark) and unpaid (orange, `#f97316` / `stroke-orange-500` — same orange already used for the non-LUNAS badge in `History.jsx`). This is a **status** encoding (good/bad), not a categorical one — colors are fixed to this meaning and always paired with a text label (legend + tab labels), never color alone.
- Center label: large bold percentage or `paidCount / totalActive` figure in standard ink (`text-gray-900`), not colored by segment.
- Legend is always rendered alongside the chart (2 series ⇒ legend required per accessibility rules), with swatch + label + count — never relying on color alone to convey which segment is which.
- Native SVG `<title>` elements on each arc path for basic screen-reader/tooltip support. No custom hover/tooltip interaction needed for a static 2-segment donut.
- If `totalActive === 0`, the donut is not rendered (empty state from §3.2 takes over).

## 5. Acceptance Criteria

- [ ] Dashboard shows a donut chart reflecting paid vs. unpaid active customers for the currently selected month/year.
- [ ] Changing the existing month/year filter recalculates the chart and both lists.
- [ ] A tabbed control switches between "Sudah Bayar" and "Belum Bayar" customer name lists, each showing customer name + package.
- [ ] Non-active customers never appear in either list or count toward the chart.
- [ ] Counts in tab labels and legend match the list contents exactly.
- [ ] Empty states render correctly when there are 0 active customers, and independently when either tab has 0 members.
- [ ] No new npm dependencies added.
