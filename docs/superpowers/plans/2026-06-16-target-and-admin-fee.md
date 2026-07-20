# Target, Admin Fee, and CS Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement business metrics tracking (Target Sisa, Jasa Admin) and add "Bayar via CS" payment method.

**Architecture:** Update `App.jsx` to fetch new admin settings. Refactor `Settings.jsx` to allow editing these settings. Add 'CS' to `Transaksi.jsx` payment methods. Refactor `Dashboard.jsx` to calculate and display new metrics based on filtered transaction data and customer package prices.

**Tech Stack:** React, Supabase, Tailwind CSS, Lucide React.

---

### Task 1: Update Database & App State

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update SQL Schema (Instructions for user)**
Please run this SQL in your Supabase SQL Editor:
```sql
ALTER TABLE company_settings 
ADD COLUMN admin_name TEXT DEFAULT 'Admin', 
ADD COLUMN admin_fee BIGINT DEFAULT 10000;
```

- [ ] **Step 2: Update INIT_COMPANY and fetch logic in App.jsx**

```javascript
// src/App.jsx
const INIT_COMPANY = {
  name: 'PT Net Synergy Inovate',
  address: 'Loading...',
  phone: '',
  logo: null,
  adminName: 'Admin', // Add this
  adminFee: 10000     // Add this
};

// Inside useEffect fetchData...
if (settingsData) {
  setCompanyInfo({
    name: settingsData.name,
    address: settingsData.address,
    phone: settingsData.phone,
    logo: settingsData.logo_url,
    adminName: settingsData.admin_name || 'Admin', // Add this
    adminFee: settingsData.admin_fee || 10000      // Add this
  });
}

// Inside handleUpdateSettings...
const { error } = await supabase.from('company_settings').upsert({
  id: 1,
  name: newSettings.name,
  address: newSettings.address,
  phone: newSettings.phone,
  logo_url: newSettings.logo,
  admin_name: newSettings.adminName, // Add this
  admin_fee: newSettings.adminFee    // Add this
});
```

- [ ] **Step 3: Commit changes**
```bash
git add src/App.jsx
git commit -m "feat: add admin name and fee to app state"
```

---

### Task 2: Refactor Settings Page

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Add Admin Settings inputs**

```javascript
// src/pages/Settings.jsx
// Add this section before "Profil Perusahaan" or "Manajemen Paket"
<div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
  <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-3">
    <User size={18} className="text-blue-500"/> Pengaturan Admin
  </h3>
  <div className="space-y-4">
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nama Admin Bertugas</label>
      <input 
        name="adminName" 
        value={localCompany.adminName || ''} 
        onChange={handleLocalChange} 
        onBlur={handleBlur} 
        type="text" 
        placeholder="Contoh: Admin Budi"
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
      />
    </div>
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Jasa per Transaksi (Rp)</label>
      <input 
        name="adminFee" 
        value={localCompany.adminFee || ''} 
        onChange={handleLocalChange} 
        onBlur={handleBlur} 
        type="number" 
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit changes**
```bash
git add src/pages/Settings.jsx
git commit -m "feat: add admin settings inputs"
```

---

### Task 3: Add CS Payment Method to Transaksi Page

**Files:**
- Modify: `src/pages/Transaksi.jsx`

- [ ] **Step 1: Add 'CS' to payment methods and update completion logic**

```javascript
// src/pages/Transaksi.jsx
// Add 'CS' to paymentMethods array
const paymentMethods = ['Tunai', 'Transfer', 'CS'];

// Inside handleComplete...
// Ensure 'CS' method sets status to 'LUNAS' or handled correctly
```

- [ ] **Step 2: Commit changes**
```bash
git add src/pages/Transaksi.jsx
git commit -m "feat: add 'CS' payment method"
```

---

### Task 4: Upgrade Dashboard Metrics

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Implement Metrics Calculation and Layout**

```javascript
// src/pages/Dashboard.jsx
const Dashboard = ({ transactions = [], customers = [], companyInfo, setReceiptToView, setInstansiReceiptToView }) => {
  // ... existing filtering logic ...

  // 1. Total Potential Target (All active customers' package prices for this month)
  // Note: We'll sum all customers' package prices as the "Potential Target"
  const potentialTarget = customers.reduce((acc, cust) => {
    // Find package price (we might need packages list or just price from cust.package if it's stored)
    // For now, let's assume we need access to 'packages' to get the price
    // Or if customers stores the price directly.
    // Let's pass 'packages' to Dashboard in App.jsx
  }, 0);

  // 2. Gross Revenue (Total successful transactions)
  const grossRevenue = filteredTransactions.reduce((acc, curr) => acc + curr.price, 0);

  // 3. Remaining Target
  const remainingTarget = potentialTarget - grossRevenue;

  // 4. Admin Fee Income
  const successTrxCount = filteredTransactions.filter(t => t.status === 'LUNAS' && t.payment_method !== 'CS').length;
  const adminIncome = successTrxCount * (companyInfo.adminFee || 10000);

  return (
    // New 2x2 grid for metrics:
    // [Target Sisa] [Jasa Admin]
    // [Total Kotor] [Total Pelanggan]
  );
};
```

- [ ] **Step 2: Commit changes**
```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: implement target and admin fee metrics on dashboard"
```

---

### Task 5: Integration Check

- [ ] **Step 1: Pass 'packages' and 'companyInfo' to Dashboard in App.jsx**
- [ ] **Step 2: Final Smoke Test**
