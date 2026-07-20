# Design Spec: Settings UI Upgrade

**Date:** 2026-06-16
**Status:** Approved
**Topic:** Settings Page UI/UX Redesign

## 1. Overview
The goal is to modernize the Settings page by organizing configurations into logical sections, improving visual hierarchy, and enhancing the overall aesthetic to match the new Dashboard style.

## 2. UI/UX Changes

### 2.1. Header Section
- **Style:** Gradient background (Blue-600 to Blue-800).
- **Content:** Large title "Pengaturan Sistem" with a subtitle and a representative icon (Building2).
- **Shape:** Rounded bottom corners (approx. 2rem).

### 2.2. Grouped Sections
Settings will be organized into distinct cards:
- **Admin Profile:** Contains "Admin Name" and "Admin Fee" settings.
- **Store Identity:** Contains "Company Name", "Address", "Phone", and "Logo Upload".
- **Connectivity:** Contains "Bluetooth Printer" and "PWA Installation" (if applicable).
- **Packages:** Package management with a list and "Add New" form.

### 2.3. Component Styling
- **Cards:** White background, `rounded-xl` (matching the new boxy-rounded style), thin gray border, and light shadow.
- **Inputs:** Soft gray background (`bg-gray-50`), gray border, `rounded-lg`, and blue focus states.
- **Icons:** Use Lucide icons with colored backgrounds (e.g., Blue-50 for Admin, Green-50 for Printer).
- **Typography:** Plus Jakarta Sans (preferred), bold headers, and uppercase tracking for section labels.

### 2.4. Actions
- **Autosave:** Continue using the `onBlur` pattern for instant feedback.
- **Danger Zone:** "Exit/Logout" button at the bottom with a red theme.

## 3. Technical Implementation

### 3.1. Components
- **Settings.jsx:** Will be refactored to use the new layout structure. Existing logic for Bluetooth and Supabase sync will remain.
- **Styles:** Tailwind CSS classes will be used for the new layout.

## 4. Acceptance Criteria
- [ ] Settings page follows the new grouped card layout.
- [ ] Header has the new gradient style.
- [ ] All existing functionalities (BT connection, Package CRUD, Company Info sync) remain intact.
- [ ] UI is responsive and uses the new "boxy-rounded" corner style (rounded-xl).
