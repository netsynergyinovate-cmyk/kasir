# Design Spec: Target, Admin Fee, and CS Payment

**Date:** 2026-06-16
**Status:** Approved
**Topic:** Business Metrics, Payment Methods, and Admin Settings

## 1. Overview
This feature introduces business tracking metrics to the Dashboard. It calculates the "Remaining Target" based on registered customers, tracks "Admin Fees" for successful transactions (excluding CS payments), and allows configuring admin details in the Settings page.

## 2. Data Model Changes

### 2.1. Supabase Schema Updates
- **Table `company_settings`:**
    - Add `admin_name` (text, default 'Admin').
    - Add `admin_fee` (bigint, default 10000).
- **Table `transactions`:**
    - `payment_method` will now accept 'CS' as a valid option.

## 3. Dashboard Logic (Current Month)

### 3.1. Metrics Calculation
- **Total Registered Customers:** `customers.length`.
*   **Total Potential Target:** Sum of all active customer package prices for the current month.
*   **Gross Revenue:** Total sum of all `transactions` with status 'LUNAS' (regardless of payment method).
*   **Remaining Target:** `Total Potential Target - Gross Revenue`.
*   **Admin Fee (Jasa Kasir):** `(Number of Successful Transactions - Number of CS Transactions) * admin_fee`.

## 4. UI/UX Changes

### 4.1. Dashboard Page
- Display "Halo, [admin_name] 👋" in the header.
- Add a 2x2 grid of cards for:
    - **Target Sisa:** (Indigo card)
    - **Jasa Admin:** (Emerald card)
    - **Total Kotor:** (White card)
    - **Total Pelanggan:** (White card)

### 4.2. Settings Page
- Add "Pengaturan Admin" section with inputs for:
    - **Nama Admin Bertugas**
    - **Besaran Jasa per Transaksi**

### 4.3. Transaksi Page (POS)
- Add "Bayar via CS" to the Payment Method selection.
- Selecting "CS" will set `payment_method` to 'CS' and `status` to 'LUNAS'.

## 5. Acceptance Criteria
- [ ] Dashboard displays accurate "Target Sisa" based on registered customers minus payments.
- [ ] Dashboard displays "Jasa Admin" correctly (Success Trx * Fee, excluding CS).
- [ ] Admin name and fee are configurable in Settings and reflected across the app.
- [ ] "Bayar via CS" is available as a payment method and correctly updates metrics.
