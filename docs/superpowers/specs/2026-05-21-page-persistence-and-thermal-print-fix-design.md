# Design Spec: Page Persistence (React Router) & Thermal Print Fix

**Date:** 2026-05-21
**Status:** Draft
**Topic:** Navigation persistence after refresh and fixing thermal receipt print alignment.

## 1. Problem Statement
1.  **Page Reset on Refresh:** The application currently uses a React `useState` (`activeTab`) to manage navigation. Refreshing the browser resets the state to 'dashboard', losing the user's current context.
2.  **Thermal Print Mismatch:** The preview shown in the app does not match the actual output of the thermal printer. Issues include incorrect width, unwanted browser margins, and font scaling problems.

## 2. Proposed Solution

### 2.1 Navigation Persistence (React Router)
We will migrate from state-based conditional rendering to a URL-based routing system using `react-router-dom`.

- **Router Type:** `BrowserRouter` (standard for web apps).
- **Route Mapping:**
  - `/` -> `Dashboard`
  - `/history` -> `History`
  - `/customers` -> `Pelanggan`
  - `/settings` -> `Settings`
  - `/pos` -> `Transaksi`
  - `/instansi` -> `Instansi`
- **Component Updates:**
  - `App.jsx`: Replace `activeTab` logic with `<Routes>` and `<Route>`. Pass existing props to components within routes.
  - `Navigation.jsx`: Use `NavLink` for automatic active state management.
  - `Sidebar.jsx`: Use `Link` or `useNavigate` for navigation.

### 2.2 Thermal Print Alignment Fix
We will refine `ReceiptThermal.jsx` to ensure high-fidelity printing on 58mm thermal paper.

- **CSS Media Queries:** Implement `@media print` to target thermal printers specifically.
- **Layout Adjustments:**
  - Set `@page` margin to `0`.
  - Force container width to `58mm` (or `219px` approx) for print mode.
  - Hide all non-printable elements (buttons, overlays, scrollbars).
  - Use `grayscale` and `contrast` filters for the logo to ensure clarity on black-and-white thermal heads.
  - Normalize font sizes to standard thermal receipt scales (9pt - 11pt).

## 3. Implementation Plan

### Phase 1: React Router Setup
1.  Install `react-router-dom` (already in `package.json`, so just verify).
2.  Wrap the application in `BrowserRouter` in `main.jsx`.
3.  Refactor `App.jsx` to use `<Routes>`.

### Phase 2: Component Refactoring
1.  Update `Navigation.jsx` to use `NavLink`.
2.  Update `Sidebar.jsx` to use routing.

### Phase 3: Thermal Print Styling
1.  Add a dedicated `<style>` block or update existing CSS in `ReceiptThermal.jsx`.
2.  Test print layout using browser print simulation.

## 4. Success Criteria
- [ ] Refreshing on any page (e.g., `/customers`) keeps the user on that page.
- [ ] The browser's back and forward buttons work correctly.
- [ ] The print preview matches a 58mm roll width without horizontal scroll or excessive margins.
- [ ] All action buttons are hidden during printing.
