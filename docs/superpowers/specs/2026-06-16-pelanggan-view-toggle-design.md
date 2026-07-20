# Design Spec: Pelanggan View Toggle Feature

**Date:** 2026-06-16
**Status:** Approved
**Topic:** Customer Page View Toggle (Grid vs. List)

## 1. Overview
The goal is to enhance the `Pelanggan` (Customer) page by adding a View Toggle feature. This allows users to switch seamlessly between a "Grid View" (Widget/Cards) and a "List View" (Table rows), catering to different preferences for data density and aesthetics.

## 2. UI/UX Changes

### 2.1. View Toggle Control
- **Location:** Placed in the header area of the Pelanggan page, near the search/filter controls.
- **Style:** A segmented control (button group) using icons (`LayoutGrid` and `List` from Lucide). Active state will have a white background and blue text; inactive state will have gray text.

### 2.2. Grid View (Widget Mode)
- **Layout:** Uses CSS Grid (responsive: 1 column on mobile, 2 on tablet, 3 on desktop).
- **Card Style:** Square-ish cards (`rounded-xl`).
- **Content:** Centralized avatar, name, and status. Package and due date displayed at the bottom with a separator line.
- **Actions:** Edit and Delete buttons hover over the top-right corner.

### 2.3. List View (Table Mode)
- **Layout:** A continuous list with thin borders between items.
- **Header:** Optional table header indicating columns (Pelanggan, Paket & Lokasi, Status, Aksi) on larger screens.
- **Content:** Information is spread horizontally.
- **Actions:** Edit and Delete buttons are right-aligned and appear on hover.

## 3. Technical Implementation

### 3.1. State Management
- **State:** Add a new state variable `viewMode` in `Pelanggan.jsx`.
- **Values:** `'grid'` | `'list'`. Default can be `'grid'` (to maintain current similarity) or `'list'` (for professional default). We will default to `'grid'` as it's better for mobile.

### 3.2. Rendering Logic
- Use a conditional rendering approach based on `viewMode`.
- **Grid Render:** Map through `filteredCustomers` and return the Grid Card JSX.
- **List Render:** Map through `filteredCustomers` and return the List Row JSX.

### 3.3. CSS/Styling
- Ensure `row-hover` and `group-hover` classes are utilized effectively for the List view to keep it clean.
- Ensure the Grid view wraps correctly using Tailwind's grid utilities (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

## 4. Acceptance Criteria
- [ ] A view toggle button group is present on the Pelanggan page.
- [ ] Clicking 'Grid' displays customers in card widgets.
- [ ] Clicking 'List' displays customers in a professional table-like row format.
- [ ] Both views display all necessary customer information and action buttons (Edit/Delete).
- [ ] Edit modal functionality continues to work from both views.
