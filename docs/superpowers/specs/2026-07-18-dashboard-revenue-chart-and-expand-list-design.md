# Design Spec: Dashboard Revenue Chart + Expandable Payment Lists

**Date:** 2026-07-18
**Status:** Approved
**Topic:** Adding a 6-month revenue bar chart to the Dashboard, and a "Lihat Selengkapnya" expand control to the existing Sudah Bayar / Belum Bayar customer lists. Builds on [[2026-07-18-dashboard-payment-status-design]] — nothing from that feature is removed or altered in behavior, only extended.

## 1. Overview

Two additions to the Dashboard, both reusing the existing `selectedMonth`/`selectedYear` period filter and existing data (`transactions`, `customers`):

1. The Sudah Bayar / Belum Bayar tabs (added previously) currently render every matching customer at once. For accounts with many customers this gets long. Add a 5-item cap with an expand-in-place control.
2. A new 6-month revenue trend bar chart, so the admin can see whether income is trending up or down, not just the single selected month's total.

No new dependencies (same constraint as the prior feature — hand-rolled SVG, no charting library).

## 2. Expandable Payment Lists

### 2.1 Behavior
- Each tab (Sudah Bayar, Belum Bayar) shows at most the first 5 customers from its list by default.
- If that tab's list has more than 5 entries, a text button **"Lihat Selengkapnya (N)"** appears below the visible rows, where N is the count of additional customers not currently shown (i.e., `total - 5`).
- Clicking it reveals the remaining customers in place (same list, no modal/navigation) and the button's label changes to **"Tutup"**. Clicking "Tutup" collapses back to 5.
- If a tab has 5 or fewer customers, no button is rendered — full behavior is unchanged from the current implementation.
- Expand/collapse state is independent per tab and does **not** persist across tab switches: switching from "Belum Bayar" to "Sudah Bayar" and back always starts collapsed. This keeps the state model to a single boolean per tab rather than needing to track view state per tab identity across renders.

### 2.2 State
- Two new booleans: `unpaidExpanded`, `paidExpanded` (or an equivalent keyed by tab — implementation's choice, see plan). Both default `false`.

## 3. Monthly Revenue Chart

### 3.1 Placement
New section inserted **after the Metrics Grid and before the existing "Status Pembayaran Bulan Ini" section** (from the prior feature). Full Dashboard order after this change:

1. Welcome header
2. Periode filter (month/year — existing)
3. Metrics Grid (existing 4 cards)
4. **Pendapatan 6 Bulan Terakhir** (new — this section)
5. Status Pembayaran Bulan Ini (existing donut + tabs, from prior feature)
6. Transaksi Barusan (existing highlight)
7. Riwayat Terakhir (existing paginated list)

### 3.2 Data
- Window: the 6 consecutive calendar months **ending at the currently selected** `selectedMonth`/`selectedYear` (i.e., selected month is the last/rightmost bar; the other 5 are the preceding months, correctly rolling across year boundaries).
- Value per month: gross revenue for that month — same definition as the existing "Total Kotor" card, i.e. the sum of `price` across **all** transactions (any `status`, any `type`) whose `date` falls in that month/year. This is computed by applying the same month/year filtering logic used for `filteredTransactions` (Dashboard.jsx) to each of the 6 months, not just the currently selected one.
- Changing the period filter shifts the whole 6-month window (consistent with every other section on this Dashboard).

### 3.3 Visual
- Custom inline SVG bar chart (no charting library), 6 bars, equal width, flat blue fill (`#2563eb` — the same blue already used for the "Lihat Semua" link and other primary accents in this app), rounded top corners on bars to match the app's rounded-corner visual language.
- This is a magnitude-over-ordered-time encoding: color is **not** varied by bar (varying lightness per bar would re-encode the height and add nothing — see dataviz anti-patterns on redundant encoding). All bars share the same hue.
- Each bar gets:
  - A month abbreviation label below it (`Jan`, `Feb`, ... in Indonesian short month form — reuse the existing `months` array in Dashboard.jsx, sliced to 3 letters).
  - A compact value label above it: abbreviated Rupiah (e.g. `150rb` for 150,000, `1,2jt` for 1,200,000) so it fits above a narrow bar on mobile widths. Exact formatting rule: values ≥ 1,000,000 show as `X,Yjt` (one decimal, comma as separator per Indonesian convention); values ≥ 1,000 and < 1,000,000 show as `Xrb` (rounded to nearest thousand, no decimal); values below 1,000 show the plain number. This is a new small formatting helper, separate from the existing `formatRupiah` (which produces full `Rp 150.000` strings — too wide to sit above a 1/6-width bar).
  - Direct labels substitute for a hover tooltip here (per interaction guidance, static small multi-bar charts on a touch-first mobile UI favor always-visible compact labels over hover, which doesn't exist on touch).
- Bar heights are scaled relative to the maximum value among the 6 months (tallest bar reaches full available chart height; a month with 0 revenue renders as a zero-height/minimal bar, not omitted).
- If all 6 months have 0 revenue, render the empty bars as-is (no special empty state needed — zero bars are already a valid, self-explanatory result, unlike the payment-status donut which has a true "no data" case for zero active customers).

## 4. Acceptance Criteria

- [ ] Sudah Bayar / Belum Bayar tabs show at most 5 customers by default, each with a "Lihat Selengkapnya (N)" button when there are more, expanding in place on click and collapsing via "Tutup".
- [ ] Tabs with ≤5 customers show no expand button (unchanged from before).
- [ ] A new bar chart shows 6 months of gross revenue, ending at the currently selected month/year.
- [ ] Changing the period filter shifts the chart's 6-month window.
- [ ] Each bar shows a month label and an abbreviated Rupiah value label.
- [ ] No existing Dashboard functionality (metrics grid, payment status donut/tabs, latest highlight, paginated history list) is altered or removed.
- [ ] No new npm dependencies added.
