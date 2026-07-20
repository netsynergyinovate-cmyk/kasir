# Design Spec: Pelanggan Page Upgrade & Edit Feature

**Date:** 2026-06-16
**Status:** Approved
**Topic:** Customer List Redesign and Edit Modal

## 1. Overview
The goal is to upgrade the UI of the `Pelanggan` (Customer) page to match the application's new "boxy-rounded" aesthetic and to introduce a feature to edit existing customer details using a Pop-up Modal approach.

## 2. UI/UX Changes

### 2.1. Customer List Cards
- **Style:** Update cards to use `rounded-xl` and standard shadow/border styling.
- **Layout:** 
  - Avatar (initials) on the left.
  - Name and Nickname prominently displayed.
  - Package and Address below the name with icons.
- **Action Buttons:** Move action buttons (Edit and Delete) to a dedicated area (e.g., top-right corner or right-aligned container) inside the card for better visibility and touch targets.

### 2.2. Edit Feature (Modal Approach - Option A)
- **Interaction:** Clicking the Edit (Pencil) button on a customer card opens a modal.
- **Modal Component:** Reuse or duplicate the logic of `AddCustomerModal.jsx` but pre-fill it with the selected customer's data.
- **Fields to Edit:** Name, Nickname, Address, Package, Due Date.
- **Validation:** Ensure required fields are filled before saving.

## 3. Technical Implementation

### 3.1. Components
- **Pelanggan.jsx:** 
  - Update JSX for the customer list to match the new UI.
  - Add state `editingCustomer` (stores the customer object being edited, or null).
  - Add an `<EditCustomerModal>` component (can be a new component or integrated if simple enough, but a separate component is cleaner).
- **App.jsx:**
  - Add `handleUpdateCustomerDB` function to handle the Supabase `update` call.
  - Pass this function down to `Pelanggan.jsx`.

### 3.2. Data Flow
1. User clicks Edit -> `editingCustomer` state is set.
2. Modal opens with `editingCustomer` data.
3. User submits modal -> Calls `onUpdateCustomer(updatedData)`.
4. `App.jsx` updates Supabase and then updates local `customers` state.
5. Modal closes.

## 4. Acceptance Criteria
- [ ] Customer cards follow the new modern UI design.
- [ ] Each card has an Edit and Delete button.
- [ ] Clicking Edit opens a modal pre-filled with customer data.
- [ ] Saving the modal successfully updates the database and local state.
- [ ] The page remains responsive and matches the app's aesthetic.
