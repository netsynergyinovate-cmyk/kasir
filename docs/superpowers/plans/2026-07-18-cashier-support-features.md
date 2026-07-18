# Cashier Support Features (Batch 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement four independent features from the approved spec: real transaction notifications, a due-date/overdue reminder section on the Dashboard, a global search modal, and a cashier activity log page.

**Architecture:** Each feature is additive and independently shippable. Feature order below is smallest/lowest-risk first. No existing behavior changes except: (a) `Pelanggan.jsx` gains a `?q=` seed for its existing search box, (b) the shared `<header>` in `App.jsx` gains one new icon button.

**Tech Stack:** React, Tailwind CSS, Lucide React, react-router-dom (existing stack only — no new npm packages, no new Supabase tables).

## Global Constraints

- No new npm dependencies, no new Supabase tables/columns (per spec §0).
- No automated test runner exists in this project — verification is `npm run lint` after each change, `npm run build` at the end, and targeted `react-dom/server` render-and-assert checks (same technique used in the two prior Dashboard features) where a component can be rendered with mock data. Interactive-only behavior (modal open/close, notification permission prompts, real browser search-and-click flows) needs the user's own browser to confirm, same caveat as before.
- Every new list styled in this plan reuses the visual conventions already established in `src/pages/Dashboard.jsx` (rows: `bg-gray-50 rounded-xl` for reminders/lists; status badges: `text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter`).

---

### Task 1: Fix `showNotification` to show real browser notifications

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `showNotification(title: string, body: string) => Promise<void>` (unchanged signature — call sites at the existing `handleTransactionComplete`/`handleInstansiComplete` do not change).

- [ ] **Step 1: Replace the stub**

Find:

```javascript
  const showNotification = async (title, body) => {
    console.log('Notification:', title, body);
  };
```

Replace with:

```javascript
  const showNotification = async (title, body) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/App.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: show real browser notifications on transaction success"
```

---

### Task 2: Add "Pengingat Tagihan" (due-date reminder) section to Dashboard

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `activeCustomers` (existing, line 60), `transactions` (prop, unfiltered — deliberately not `filteredTransactions`, since this feature ignores the period filter).
- Produces: `reminderList` (array of customer objects with an added `dueDiff` number field), `reminderExpanded`/`setReminderExpanded` (state) — used only within this file's JSX.

- [ ] **Step 1: Add reminder state**

Find:

```javascript
  const [activePaymentTab, setActivePaymentTab] = useState('unpaid');
  const [unpaidExpanded, setUnpaidExpanded] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
```

Replace with:

```javascript
  const [activePaymentTab, setActivePaymentTab] = useState('unpaid');
  const [unpaidExpanded, setUnpaidExpanded] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
  const [reminderExpanded, setReminderExpanded] = useState(false);
```

- [ ] **Step 2: Add reminder derivation logic**

Find:

```javascript
  const paidCustomers = activeCustomers.filter(isPaidThisPeriod);
  const unpaidCustomers = activeCustomers.filter(c => !isPaidThisPeriod(c));
  const totalActiveCustomers = activeCustomers.length;

  // Latest highlight (within filtered list)
```

Replace with:

```javascript
  const paidCustomers = activeCustomers.filter(isPaidThisPeriod);
  const unpaidCustomers = activeCustomers.filter(c => !isPaidThisPeriod(c));
  const totalActiveCustomers = activeCustomers.length;

  // Due-date reminders: always based on the real current date, independent of the period filter above.
  const today = new Date();
  const isPaidThisRealMonth = (customer) => transactions.some(trx =>
    trx.type === 'retail' &&
    trx.status === 'LUNAS' &&
    (trx.customerName || '').trim().toLowerCase() === (customer.name || '').trim().toLowerCase() &&
    new Date(trx.date).getMonth() === today.getMonth() &&
    new Date(trx.date).getFullYear() === today.getFullYear()
  );

  const reminderList = activeCustomers
    .filter(c => c.due_date !== null && c.due_date !== undefined && !isPaidThisRealMonth(c))
    .map(c => ({ ...c, dueDiff: today.getDate() - Number(c.due_date) }))
    .filter(c => c.dueDiff >= -3)
    .sort((a, b) => b.dueDiff - a.dueDiff);

  const getReminderBadge = (diff) => {
    if (diff > 0) return { text: `Terlambat ${diff} hari`, className: 'bg-red-100 text-red-700' };
    if (diff === 0) return { text: 'Jatuh tempo hari ini', className: 'bg-orange-100 text-orange-700' };
    return { text: `H-${Math.abs(diff)}`, className: 'bg-amber-100 text-amber-700' };
  };

  // Latest highlight (within filtered list)
```

- [ ] **Step 3: Render the section**

Find:

```javascript
      {/* Professional Period Filter (Compact) */}
```

Replace with:

```javascript
      {/* Pengingat Tagihan (due-date reminders, always real-time) */}
      {reminderList.length > 0 && (
        <div>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">⏰ Pengingat Tagihan</h2>
          <div className="bg-white p-5 super-rounded border border-gray-100 shadow-sm">
            <div className="space-y-2">
              {(reminderExpanded ? reminderList : reminderList.slice(0, 5)).map(cust => {
                const badge = getReminderBadge(cust.dueDiff);
                return (
                  <div key={cust.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-800 text-xs leading-tight">{cust.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{cust.package}</p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                );
              })}
            </div>
            {reminderList.length > 5 && (
              <button
                onClick={() => setReminderExpanded(v => !v)}
                className="w-full text-center text-[10px] font-bold text-blue-600 mt-2 py-1.5 hover:underline"
              >
                {reminderExpanded ? 'Tutup' : `Lihat Selengkapnya (${reminderList.length - 5})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Professional Period Filter (Compact) */}
```

- [ ] **Step 4: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/pages/Dashboard.jsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: add due-date reminder section to dashboard"
```

---

### Task 3: Global Search modal

**Files:**
- Create: `src/components/GlobalSearch.jsx`
- Modify: `src/App.jsx`
- Modify: `src/pages/Pelanggan.jsx`

**Interfaces:**
- Produces (`GlobalSearch.jsx`): default export, props `{ isOpen: boolean, onClose: () => void, customers: Array, transactions: Array, setReceiptToView: (trx) => void, setInstansiReceiptToView: (trx) => void }`.
- Consumes in `App.jsx`: new state `isSearchOpen`/`setIsSearchOpen`; existing `customers`, `transactions`, `setReceiptToView`, `setInstansiReceiptToView`.
- Consumes in `Pelanggan.jsx`: `useSearchParams` from `react-router-dom` to read `q`.

- [ ] **Step 1: Write `GlobalSearch.jsx`**

```jsx
// src/components/GlobalSearch.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, FileText, Building2 } from 'lucide-react';

const GlobalSearch = ({ isOpen, onClose, customers = [], transactions = [], setReceiptToView, setInstansiReceiptToView }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedCustomers = q
    ? customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      ).slice(0, 8)
    : [];

  const matchedTransactions = q
    ? transactions.filter(trx =>
        (trx.customerName || '').toLowerCase().includes(q) ||
        (trx.instansiName || '').toLowerCase().includes(q) ||
        trx.id.toLowerCase().includes(q)
      ).slice(0, 8)
    : [];

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleCustomerClick = (cust) => {
    handleClose();
    navigate(`/customers?q=${encodeURIComponent(cust.name)}`);
  };

  const handleTransactionClick = (trx) => {
    handleClose();
    if (trx.type === 'instansi') {
      setInstansiReceiptToView(trx);
    } else {
      setReceiptToView(trx);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 print:hidden" onClick={handleClose}>
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <Search size={20} className="text-gray-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pelanggan atau transaksi..."
            className="flex-1 outline-none text-sm font-medium bg-transparent"
          />
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q && (
            <p className="text-center text-gray-400 text-xs font-medium py-10">Ketik untuk mencari pelanggan atau transaksi...</p>
          )}

          {q && matchedCustomers.length === 0 && matchedTransactions.length === 0 && (
            <p className="text-center text-gray-400 text-xs font-medium py-10">Tidak ditemukan</p>
          )}

          {matchedCustomers.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">Pelanggan</p>
              {matchedCustomers.map(cust => (
                <button
                  key={cust.id}
                  onClick={() => handleCustomerClick(cust)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-gray-800 text-xs truncate">{cust.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{cust.package}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {matchedTransactions.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">Transaksi</p>
              {matchedTransactions.map(trx => (
                <button
                  key={trx.id}
                  onClick={() => handleTransactionClick(trx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center shrink-0">
                    {trx.type === 'instansi' ? <Building2 size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-gray-800 text-xs truncate">
                      {trx.type === 'instansi' ? trx.instansiName : trx.customerName}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{trx.id}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
```

- [ ] **Step 2: Wire into `App.jsx` — state, import, header button, render**

Find:

```javascript
import { Menu, Building2 } from 'lucide-react';
```

Replace with:

```javascript
import { Menu, Building2, Search } from 'lucide-react';
```

Find:

```javascript
import ReceiptA4 from './components/ReceiptA4';
```

Replace with:

```javascript
import ReceiptA4 from './components/ReceiptA4';
import GlobalSearch from './components/GlobalSearch';
```

Find:

```javascript
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
```

Replace with:

```javascript
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
```

Find:

```javascript
          <div className="overflow-hidden">
            <h1 className="font-bold text-gray-900 text-[15px] leading-tight truncate">{companyInfo.name}</h1>
            <p className="text-[11px] text-gray-500 font-medium">ISP Billing POS</p>
          </div>
        </header>
```

Replace with:

```javascript
          <div className="overflow-hidden">
            <h1 className="font-bold text-gray-900 text-[15px] leading-tight truncate">{companyInfo.name}</h1>
            <p className="text-[11px] text-gray-500 font-medium">ISP Billing POS</p>
          </div>

          <button onClick={() => setIsSearchOpen(true)} className="ml-auto p-2 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shrink-0">
            <Search size={20} />
          </button>
        </header>
```

Find:

```javascript
      <AddCustomerModal 
        show={showAddCustomer} 
        packages={packages}
        onClose={() => setShowAddCustomer(false)} 
        onAdd={handleAddCustomer} 
      />
```

Replace with:

```javascript
      <AddCustomerModal 
        show={showAddCustomer} 
        packages={packages}
        onClose={() => setShowAddCustomer(false)} 
        onAdd={handleAddCustomer} 
      />

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        customers={customers}
        transactions={transactions.map(t => ({ ...t, customerName: t.customer_name, instansiName: t.instansi_name }))}
        setReceiptToView={setReceiptToView}
        setInstansiReceiptToView={setInstansiReceiptToView}
      />
```

- [ ] **Step 3: Seed `Pelanggan.jsx`'s search box from `?q=`**

Find:

```javascript
import React, { useState } from 'react';
import { Search, PlusCircle, Wifi, Trash2, Pencil, MapPin, LayoutGrid, List, Calendar, User } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';

const Pelanggan = ({ customers = [], packages = [], setShowAddCustomer, onDeleteCustomer, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
```

Replace with:

```javascript
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, PlusCircle, Wifi, Trash2, Pencil, MapPin, LayoutGrid, List, Calendar, User } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';

const Pelanggan = ({ customers = [], packages = [], setShowAddCustomer, onDeleteCustomer, onUpdateCustomer }) => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchTerm(q);
  }, [searchParams]);
```

- [ ] **Step 4: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/components/GlobalSearch.jsx`, `src/App.jsx`, `src/pages/Pelanggan.jsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/GlobalSearch.jsx src/App.jsx src/pages/Pelanggan.jsx
git commit -m "feat: add global search modal for customers and transactions"
```

---

### Task 4: Cashier Activity Log page

**Files:**
- Create: `src/pages/Aktivitas.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Produces (`Aktivitas.jsx`): default export, props `{ transactions: Array<{ id, date, cashierName, customerName, instansiName, price, type }> }`.

- [ ] **Step 1: Write `Aktivitas.jsx`**

```jsx
// src/pages/Aktivitas.jsx
import React, { useState } from 'react';
import { Search, Calendar, Filter } from 'lucide-react';
import { formatRupiah } from '../utils/format';

const Aktivitas = ({ transactions = [] }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cashierFilter, setCashierFilter] = useState('');

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const filteredByPeriod = transactions.filter(trx => {
    const trxDate = new Date(trx.date);
    return trxDate.getMonth() === Number(selectedMonth) && trxDate.getFullYear() === Number(selectedYear);
  });

  const filteredTransactions = cashierFilter
    ? filteredByPeriod.filter(trx => (trx.cashierName || '').toLowerCase().includes(cashierFilter.toLowerCase()))
    : filteredByPeriod;

  const cashierSummary = filteredByPeriod.reduce((acc, trx) => {
    const name = trx.cashierName || 'Tanpa Nama';
    if (!acc[name]) acc[name] = { count: 0, total: 0 };
    acc[name].count += 1;
    acc[name].total += trx.price;
    return acc;
  }, {});

  const cashierSummaryList = Object.entries(cashierSummary)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Aktivitas Kasir</h2>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-9"
            >
              {months.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold text-gray-700 appearance-none pl-9"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
          </div>
        </div>

        <div className="bg-gray-50 flex items-center p-2 rounded-xl border border-gray-100">
          <Search size={18} className="text-gray-400 ml-1" />
          <input
            type="text"
            placeholder="Cari nama kasir..."
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="bg-transparent border-none outline-none p-2 w-full text-xs font-medium"
          />
        </div>
      </div>

      {cashierSummaryList.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {cashierSummaryList.map(c => (
            <div key={c.name} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 truncate">{c.name}</p>
              <p className="text-lg font-black text-gray-900">{formatRupiah(c.total)}</p>
              <p className="text-[10px] text-gray-500 mt-1">{c.count} transaksi</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 mt-2">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((trx) => (
            <div key={trx.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-blue-700">{trx.cashierName || 'Tanpa Nama'}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(trx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' '}
                  {new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">
                  {trx.type === 'instansi' ? trx.instansiName : trx.customerName}
                </p>
                <p className="font-black text-sm text-gray-900">{formatRupiah(trx.price)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center">
            <p className="text-gray-400 text-xs font-medium">Tidak ada aktivitas pada periode ini</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Aktivitas;
```

- [ ] **Step 2: Wire the route in `App.jsx`**

Find:

```javascript
import History from './pages/History';
```

Replace with:

```javascript
import History from './pages/History';
import Aktivitas from './pages/Aktivitas';
```

Find:

```javascript
            <Route path="/instansi" element={
               <Instansi onComplete={handleInstansiComplete} />
            } />
          </Routes>
```

Replace with:

```javascript
            <Route path="/instansi" element={
               <Instansi onComplete={handleInstansiComplete} />
            } />
            <Route path="/aktivitas" element={
              <Aktivitas
                transactions={transactions.map(t => ({ ...t, customerName: t.customer_name, instansiName: t.instansi_name, cashierName: t.cashier_name }))}
              />
            } />
          </Routes>
```

- [ ] **Step 3: Add Sidebar link**

Find:

```javascript
import { X, Home, Users, Printer, Settings as SettingsIcon, Building2, ChevronRight } from 'lucide-react';
```

Replace with:

```javascript
import { X, Home, Users, Printer, Settings as SettingsIcon, Building2, ChevronRight, Activity } from 'lucide-react';
```

Find:

```javascript
            <NavLink to="/settings" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <SettingsIcon size={20} /> Pengaturan
            </NavLink>
```

Replace with:

```javascript
            <NavLink to="/aktivitas" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Activity size={20} /> Aktivitas Kasir
            </NavLink>
            <NavLink to="/settings" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <SettingsIcon size={20} /> Pengaturan
            </NavLink>
```

- [ ] **Step 4: Lint check**

Run: `npm run lint`
Expected: No new errors for `src/pages/Aktivitas.jsx`, `src/App.jsx`, `src/components/Sidebar.jsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Aktivitas.jsx src/App.jsx src/components/Sidebar.jsx
git commit -m "feat: add cashier activity log page"
```

---

### Task 5: Verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: Build completes with no errors.

- [ ] **Step 2: Render-and-assert check for the Dashboard reminder section**

Using the same `vite build --lib` + `react-dom/server` + `MemoryRouter` technique as the two prior Dashboard features, render `Dashboard.jsx` with mock data including:
- An active customer with `due_date` in the past relative to a fixed mock "today" and no matching current-month LUNAS transaction → expect `Terlambat` badge text in the output.
- An active customer with `due_date` equal to today → expect `Jatuh tempo hari ini`.
- An active customer with `due_date` 2 days in the future → expect `H-2`.
- An active customer with `due_date` far in the future (> 3 days) → expect that customer's name absent from the reminder section.
- An active customer with no `due_date` → expect that customer's name absent from the reminder section.
- Assert the heading `Pengingat Tagihan` appears when the list is non-empty, and does not appear when every active customer is either paid, has no `due_date`, or is not yet due.

Note: since `today` inside the component is `new Date()` at render time (real wall-clock), construct the mock transactions/customers' dates relative to the actual current date when the check script runs (e.g. `due_date` = `(new Date().getDate() - 3)` normalized into 1-31 range) rather than hard-coded calendar dates, so the assertions hold regardless of when this plan is executed.

- [ ] **Step 3: Render-and-assert check for `Aktivitas.jsx`**

Bundle `Aktivitas.jsx` the same way (`vite build --lib`, entry `src/pages/Aktivitas.jsx`), render with mock transactions from at least 2 different `cashierName` values in the current month, assert:
1. Renders without throwing.
2. Both cashier names appear in the per-cashier summary cards.
3. Filtering via the `cashierFilter` state isn't directly testable via static markup (it's a controlled input with no default value), so this only confirms the default (unfiltered) render — note this limitation rather than skipping the check.

- [ ] **Step 4: Manual/browser verification note**

The following are interaction-only and cannot be verified via `renderToStaticMarkup` — note in the final summary that the user should confirm them live: the search icon opens/closes the modal, typing filters results live, clicking a customer result navigates to `/customers?q=...` with the search box prefilled, clicking a transaction result opens the correct receipt overlay, and a real transaction triggers a visible OS-level notification (requires notification permission granted in the browser).
