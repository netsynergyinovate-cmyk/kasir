# Design Spec: Dashboard Upgrade & Pagination

**Date:** 2026-06-16
**Status:** Approved
**Topic:** Dashboard UI/UX, Pagination, and Monthly Filters

## 1. Overview
The goal is to upgrade the Dashboard to be more modern and functional. This includes adding a "Latest Successful Transaction" highlight, implementing pagination for the transaction list (5 items per page), and adding monthly filters for revenue tracking.

## 2. UI/UX Changes

### 2.1. "Just Now" Highlight
- **Placement:** Top of the Dashboard, below the stats but above the transaction list.
- **Content:** Displays exactly **one** latest transaction that is successful (Status: LUNAS or type: Instansi).
- **Style:** Uses a distinct, prominent card (e.g., light green background for success) with a "JUST NOW" or "BARU SAJA" badge.
- **Behavior:** This section updates automatically when a new transaction is completed.

### 2.2. Paginated Transaction List
- **Constraint:** Maximum **5 items** per page.
- **Navigation:** "Prev" and "Next" buttons located next to the "Last Transactions" heading.
- **Data Source:** Shows historical transactions excluding the one already highlighted (if applicable, or simply the full list paginated).
- **Style:** Clean cards with improved spacing and typography.

### 2.3. Monthly Filter
- **Functionality:** Filter stats (Total Income) and potentially the transaction list by Month and Year.
- **UI:** A dropdown or selector for Month/Year, integrated near the revenue card.

## 3. Technical Implementation

### 3.1. Components
- **Dashboard.jsx:** Will be refactored to include pagination logic (`useState` for `currentPage`).
- **Dashboard.css:** Will be updated with new styles for cards, pagination buttons, and the highlight section.

### 3.2. Data Flow
- `transactions` prop from `App.jsx` will be used.
- Logic to derive `latestTransaction` for the highlight section.
- Logic to slice `transactions` based on `currentPage` and `itemsPerPage` (5).

### 3.3. State Management
- `currentPage`: Current page index for pagination.
- `selectedMonth`: For filtering.
- `selectedYear`: For filtering.

## 4. Acceptance Criteria
- [ ] Dashboard shows exactly one highlight card for the most recent successful transaction.
- [ ] Transaction list is capped at 5 items per page.
- [ ] Prev/Next buttons successfully navigate through pages.
- [ ] Monthly filter correctly updates the total income displayed.
- [ ] UI is modern, clean, and responsive (mobile-first).
