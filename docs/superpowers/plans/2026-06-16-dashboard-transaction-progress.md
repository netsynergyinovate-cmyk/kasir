# Dashboard Transaction Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 'Total Pelanggan' card with a 'Progres Penagihan' card that shows a progress bar of successful transactions vs total customers.

**Architecture:** Modify `Dashboard.jsx`. Calculate the total number of successful transactions for the selected month (including CS payments). Compare this against `customers.length`. Render a progress bar using Tailwind CSS.

**Tech Stack:** React, Tailwind CSS, Lucide React.

---

### Task 1: Update Dashboard Metrics Logic

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Calculate total successful transactions**

```javascript
// src/pages/Dashboard.jsx
// Locate the existing metric calculations and add the following:

  // Total successful transactions (including CS, needed for progress bar)
  const totalSuccessTrx = filteredTransactions.filter(t => 
    t.status === 'LUNAS' || t.type === 'instansi'
  ).length;

  const totalCustomers = customers.length;
  // Calculate percentage, ensure it doesn't exceed 100% or drop below 0, handle 0 customers
  const progressPercentage = totalCustomers > 0 
    ? Math.min(Math.round((totalSuccessTrx / totalCustomers) * 100), 100) 
    : 0;
```

- [ ] **Step 2: Commit changes**
```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: add logic for transaction progress metric"
```

---

### Task 2: Replace Total Pelanggan Card with Progress Bar

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Update the JSX in the Metrics Grid**

```javascript
// src/pages/Dashboard.jsx
// Find the "Total Pelanggan Card" and replace it with:

        {/* Progres Penagihan Card */}
        <div className="stat-card p-5 super-rounded flex flex-col justify-center">
          <div className="flex justify-between items-end mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progres Penagihan</p>
            <p className="text-[10px] font-bold text-blue-600">{progressPercentage}%</p>
          </div>
          
          <div className="flex items-baseline gap-1 mb-3">
            <p className="text-2xl font-black text-gray-900 leading-none">{totalSuccessTrx}</p>
            <p className="text-xs font-bold text-gray-400">/ {totalCustomers}</p>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          <p className="text-[9px] text-gray-400 font-medium text-right">
            {totalCustomers - totalSuccessTrx > 0 
              ? `${totalCustomers - totalSuccessTrx} trx belum lunas` 
              : 'Semua lunas! 🎉'}
          </p>
        </div>
```

- [ ] **Step 2: Commit changes**
```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: implement transaction progress UI on dashboard"
```

---

### Task 3: Final Verification

- [ ] **Step 1: Smoke Test**
1. Check if the "Progres Penagihan" card replaces the old "Total Pelanggan" card.
2. Verify the numbers (e.g., 0 / 1) make sense based on the mock data.
3. Verify the progress bar width visually matches the percentage.
4. Verify the subtext correctly calculates the remaining transactions.
