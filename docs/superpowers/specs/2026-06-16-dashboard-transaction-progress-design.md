# Design Spec: Dashboard Transaction Progress Metric

**Date:** 2026-06-16
**Status:** Approved
**Topic:** Adding Transaction Target and Success Counts to Dashboard

## 1. Overview
The goal is to provide the admin with a clear understanding of how many transactions have been completed versus how many are expected (target) for the selected month. The target is defined by the total number of customers.

## 2. UI/UX Changes

### 2.1. Upgrading the "Total Pelanggan" Card
Instead of just showing the static number of registered customers, the bottom-right stat card will be upgraded into a **"Progres Penagihan" (Billing Progress)** card.

- **Title:** "Progres Penagihan"
- **Main Metric:** Displays "X / Y" where X is Successful Transactions and Y is Total Target (Customers).
- **Visual Aid:** A mini progress bar (e.g., green fill over a gray background) indicating the percentage of completion.
- **Subtitle/Status:** "X transaksi belum lunas" (X transactions remaining).

### 2.2. Data Definitions
- **Target Transaksi (Y):** `customers.length` (Total registered customers).
- **Transaksi Sukses (X):** The count of `filteredTransactions` (for the current month) where `status === 'LUNAS'` or `type === 'instansi'`.
- **Sisa Transaksi:** `Y - X`.

## 3. Technical Implementation

### 3.1. Dashboard.jsx Updates
- Calculate `successTrxCount` (which already exists partially for admin fee, but we need the raw total including CS payments for overall progress).
- Replace the existing "Total Pelanggan" JSX card with the new "Progres Penagihan" JSX structure featuring a Tailwind-styled progress bar.

## 4. Acceptance Criteria
- [ ] Dashboard displays the number of successful transactions out of the total target (customers).
- [ ] A progress bar visually represents this completion rate.
- [ ] The calculation accurately reflects the currently selected month/year filter.
