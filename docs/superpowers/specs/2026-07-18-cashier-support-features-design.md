# Design Spec: Cashier & Professional Support Features (Batch 2)

**Date:** 2026-07-18
**Status:** Approved (user requested proceeding without per-step confirmation)
**Topic:** Four independent additions requested by the user: due-date/overdue reminders, real browser notifications on transaction success, a global search, and a cashier activity log.

## 0. Overview

Four sub-features, each independently useful and independently implementable. No existing feature (Dashboard sections from the two prior specs, History, Pelanggan, Transaksi, Instansi, Settings) is altered in behavior except where explicitly noted (Pelanggan.jsx gains an additional way to seed its existing search box; the header gains one new icon button).

No new npm dependencies. No new Supabase tables — all four features are built from data that already exists (`customers.due_date`, `transactions.cashier_name`, etc.), per the codebase survey that grounded this spec.

---

## 1. Pengingat Jatuh Tempo / Tunggakan (Due-Date Reminders)

### 1.1 Placement
New Dashboard section (`src/pages/Dashboard.jsx`), inserted **right after the Welcome Header, before the existing Periode filter**. Unlike every other Dashboard section, this one is **not** driven by the page's `selectedMonth`/`selectedYear` filter — reminders are inherently about "right now," so it always uses the real current date (`new Date()`), regardless of what period the admin is browsing elsewhere on the page.

### 1.2 Data
- Base set: active customers (`customers.filter(c => c.status === 'aktif')`) — reuses the same active-customer concept as the payment-status feature.
- Exclude any active customer who already has a matching `LUNAS` `retail` transaction in the **real current** month/year (same matching predicate as the existing `isPaidThisPeriod`, i.e. case-insensitive trimmed name match, but evaluated against today's actual month/year instead of the selected filter).
- For each remaining (unpaid-this-real-month) customer, read `due_date` (day-of-month integer). If it is null/undefined, exclude that customer from this list entirely (nothing to compute).
- Compute `diff = today.getDate() - Number(due_date)`:
  - `diff > 0` → overdue by `diff` days → label `Terlambat {diff} hari`, red badge.
  - `diff === 0` → due exactly today → label `Jatuh tempo hari ini`, orange badge.
  - `diff < 0 && diff >= -3` → due within the next 1–3 days → label `H-{abs(diff)}`, amber/yellow badge.
  - `diff < -3` → not urgent yet, excluded from this list.
- Sort: most overdue first (descending `diff`).

### 1.3 UI
- Card titled "⏰ Pengingat Tagihan" — only rendered when the computed list has at least one entry; if empty, the section is omitted entirely (no "all clear" banner needed for a reminder widget — silence means nothing is due).
- Rows follow the same visual pattern as the existing payment-status list rows (name + package, badge on the right), capped at 5 with the same "Lihat Selengkapnya (N)" / "Tutup" expand control introduced for the payment-status lists (reused pattern, own independent expand state).

---

## 2. Notifikasi Transaksi Beneran (Real Browser Notifications)

### 2.1 Problem
`App.jsx`'s `showNotification` (current line ~82) is a stub that only does `console.log` — the existing `Notification.requestPermission()` call (already wired on load) has nothing real to show, so cashiers never see anything.

### 2.2 Fix
Replace the stub body so that, when the browser supports the Notification API and permission is `"granted"`, it actually shows a native notification with the given title/body (already correctly called after both retail and instansi transaction completion with a title and a customer-name + amount body — no call-site changes needed). If permission is not granted or the API is unsupported, do nothing (silent no-op — this is a nice-to-have, not a blocking concern, consistent with how the rest of this stub was already written defensively).

---

## 3. Pencarian Global (Global Search)

### 3.1 Placement
A new search icon button added to the persistent header in `App.jsx` (the `<header>` that already renders on every route, next to the existing hamburger menu button). Clicking it opens a new modal component, `GlobalSearch`.

### 3.2 Behavior
- Text input at the top of the modal. Empty query → neutral prompt ("Ketik untuk mencari pelanggan atau transaksi..."). Non-empty query with no matches → "Tidak ditemukan".
- Filters both existing top-level datasets already available in `App.jsx` (`customers`, `transactions`), each capped to the top 8 matches to keep the list short:
  - **Pelanggan**: matches on `name`, `nickname`, `address` (same case-insensitive substring logic already used in `Pelanggan.jsx`/`Transaksi.jsx`).
  - **Transaksi**: matches on `customerName`, `instansiName`, `id` (same logic already used in `History.jsx`).
- Clicking a **Pelanggan** result: closes the modal and navigates to `/customers?q={encodeURIComponent(name)}`. `Pelanggan.jsx` is extended to read the `q` query param once on mount (via `useSearchParams`) to seed its existing `searchTerm` state — the page's own search box does the rest; this is the only change to `Pelanggan.jsx`.
- Clicking a **Transaksi** result: closes the modal and calls `setReceiptToView` (retail) or `setInstansiReceiptToView` (instansi) — the same top-level state `App.jsx` already uses to open the existing receipt overlays from `History.jsx`. `GlobalSearch` receives these two setters as props from `App.jsx`.

---

## 4. Log Aktivitas Kasir (Cashier Activity Log)

### 4.1 Scope decision
There is no per-user login/role system in this app today — `cashier_name` is a free-text field typed per transaction (defaulting to `companyInfo.adminName`, editable, per `Transaksi.jsx`). Building real multi-user auth/roles is out of scope here. This feature is a **read-only reporting view** over the `cashier_name` already recorded on every transaction — no new table, no schema change.

### 4.2 Placement
New route `/aktivitas`, new page `src/pages/Aktivitas.jsx`, added as a new entry in `src/components/Sidebar.jsx`'s link list (alongside the existing Instansi shortcut).

### 4.3 Data & UI
- Own local month/year filter (same UI pattern as `History.jsx`: two `<select>`s, defaulting to the current month/year) — independent of the Dashboard's filter state (different page, own state).
- **Per-cashier summary cards**: group the filtered transactions by `cashierName`, show each distinct cashier's transaction count and total `price` for the selected month.
- **Chronological feed**: below the summary, list all filtered transactions newest-first, each row showing the cashier name prominently (this is the one piece of information `History.jsx` collects but never displays), plus the existing date/customer-or-instansi/amount info already shown elsewhere.
- Read-only: no delete/edit actions on this page (unlike `History.jsx`) — it's an audit view, not a management view.
- A simple text filter on cashier name only (not a duplicate of the global search or `History.jsx`'s existing customer/ID search) to let an owner quickly isolate one cashier's activity.

## 5. Acceptance Criteria

- [ ] Dashboard shows a "Pengingat Tagihan" section (when applicable) above the Periode filter, using real current-date logic, capped at 5 with expand, correctly categorizing overdue / due-today / due-soon customers and excluding customers without a `due_date` or already paid this real month.
- [ ] Completing a retail or instansi transaction shows a real browser notification when permission is granted.
- [ ] A search icon in the header opens a modal that searches customers and transactions live, with working navigation/overlay actions on click.
- [ ] `Pelanggan.jsx`'s search box is prefilled when arriving via `?q=`.
- [ ] A new "Aktivitas" page exists, reachable from the Sidebar, showing per-cashier totals and a cashier-attributed chronological feed for a selectable month/year, filterable by cashier name.
- [ ] No new npm dependencies, no new Supabase tables/columns.
- [ ] All previously existing Dashboard/History/Pelanggan/Transaksi/Instansi/Settings behavior is unchanged.
