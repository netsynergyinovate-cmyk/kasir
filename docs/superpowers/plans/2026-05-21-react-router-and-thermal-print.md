# Page Persistence & Thermal Print Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement page persistence after refresh using React Router and fix thermal receipt printing alignment for 58mm paper.

**Architecture:** 
1.  Wrap the app in `BrowserRouter`.
2.  Replace state-based navigation with `Routes` and `Route` in `App.jsx`.
3.  Use `NavLink` for automatic active state in `Navigation.jsx`.
4.  Apply `@media print` CSS in `ReceiptThermal.jsx` to force 58mm width and hide UI elements.

**Tech Stack:** React 19, React Router 7, Tailwind CSS, Lucide React.

---

### Task 1: Setup React Router

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Wrap App with BrowserRouter**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Registrasi Service Worker PWA
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Commit**

```bash
git add src/main.jsx
git commit -m "chore: setup BrowserRouter"
```

### Task 2: Refactor App.jsx for Routing

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update imports and replace activeTab logic**
  - Import `Routes` and `Route` from `react-router-dom`.
  - Replace conditional rendering in `<main>` with `<Routes>`.

```jsx
// ... existing imports
import { Routes, Route } from 'react-router-dom';

// Inside App component:
// Remove: const [activeTab, setActiveTab] = useState('dashboard');

// Inside return:
<main className="flex-1 overflow-y-auto relative">
  <Routes>
    <Route path="/" element={
      <Dashboard 
        transactions={transactions.map(t => ({...t, customerName: t.customer_name, instansiName: t.instansi_name}))} 
        customers={customers} 
        setReceiptToView={setReceiptToView} 
        setInstansiReceiptToView={setInstansiReceiptToView} 
      />
    } />
    <Route path="/history" element={
      <History 
        transactions={transactions.map(t => ({...t, customerName: t.customer_name, instansiName: t.instansi_name, packageName: t.package_name, serviceName: t.service_name, amountPaid: t.amount_paid, cashierName: t.cashier_name}))} 
        setReceiptToView={setReceiptToView} 
        setInstansiReceiptToView={setInstansiReceiptToView} 
        onDeleteTransaction={handleDeleteTransactionDB}
      />
    } />
    <Route path="/customers" element={
      <Pelanggan 
        customers={customers} 
        setShowAddCustomer={setShowAddCustomer} 
        onDeleteCustomer={handleDeleteCustomerDB}
      />
    } />
    <Route path="/settings" element={
      <Settings 
        packages={packages} 
        onAddPackage={handleAddPackageDB}
        onDeletePackage={handleDeletePackageDB}
        companyInfo={companyInfo}
        setCompanyInfo={handleUpdateSettings}
        btDevice={btDevice}
        isConnecting={isConnecting}
        connectBluetooth={connectBluetooth}
        disconnectBluetooth={disconnectBluetooth}
        savedDeviceName={savedDeviceName}
      />
    } />
    <Route path="/pos" element={
      <Transaksi 
        customers={customers} 
        packages={packages}
        onComplete={handleTransactionComplete} 
      />
    } />
    <Route path="/instansi" element={
       <Instansi onComplete={handleInstansiComplete} />
    } />
  </Routes>
</main>
```

- [ ] **Step 2: Update Navigation and Sidebar props**
  - Remove `activeTab` and `setActiveTab` props as they will use routing internally.

```jsx
<Sidebar 
  isOpen={isSidebarOpen} 
  setIsOpen={setIsSidebarOpen} 
  companyInfo={companyInfo} 
/>

// ...

<Navigation />
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: migrate App to React Router"
```

### Task 3: Update Navigation Component

**Files:**
- Modify: `src/components/Navigation.jsx`

- [ ] **Step 1: Replace buttons with NavLink**
  - Import `NavLink` from `react-router-dom`.
  - Use `isActive` callback to style icons.

```jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, History, Settings as SettingsIcon, PlusCircle } from 'lucide-react';

const Navigation = () => {
  const getNavLinkClass = ({ isActive }) => 
    `flex flex-col items-center gap-1 w-14 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`;

  const getIconClass = (isActive) => isActive ? 'fill-blue-50' : '';

  return (
    <nav className="bg-white border-t border-gray-200 h-[72px] flex justify-between items-center px-2 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.03)] shrink-0 fixed bottom-0 left-0 right-0 max-w-md mx-auto print:hidden">
      <div className="flex w-full justify-between items-center relative">
        <div className="flex justify-around w-[40%]">
          <NavLink to="/" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Home size={22} className={getIconClass(isActive)} />
                <span className="text-[9px] font-bold">Beranda</span>
              </>
            )}
          </NavLink>
          <NavLink to="/customers" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Users size={22} className={getIconClass(isActive)} />
                <span className="text-[9px] font-bold">Pelanggan</span>
              </>
            )}
          </NavLink>
        </div>

        <div className="w-[20%]"></div>

        <div className="flex justify-around w-[40%]">
          <NavLink to="/history" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <History size={22} className={getIconClass(isActive)} />
                <span className="text-[9px] font-bold">Riwayat</span>
              </>
            )}
          </NavLink>
          <NavLink to="/settings" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <SettingsIcon size={22} className={getIconClass(isActive)} />
                <span className="text-[9px] font-bold">Setting</span>
              </>
            )}
          </NavLink>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center justify-center z-30">
          <NavLink to="/pos" className="group">
            <div className="w-[60px] h-[60px] bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(37,99,235,0.4)] border-4 border-gray-50 group-active:scale-95 transition-transform mb-1">
              <PlusCircle size={28} />
            </div>
            <span className="text-[10px] font-black tracking-tight text-gray-700 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-sm border border-gray-100 whitespace-nowrap block text-center">
              Transaksi Baru
            </span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Navigation.jsx
git commit -m "feat: use NavLink in Navigation component"
```

### Task 4: Update Sidebar Component

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Replace button with Link**
  - Import `Link` and `useLocation` from `react-router-dom`.

```jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Home, Users, Printer, Settings as SettingsIcon, Building2, ChevronRight } from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen, companyInfo }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* ... overlay code unchanged ... */}
      
      <div className={`fixed top-0 left-0 h-full w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out shadow-2xl print:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         {/* ... header code unchanged ... */}
         
         <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Layanan Korporat / B2B</div>
            <Link 
              to="/instansi" 
              onClick={() => setIsOpen(false)} 
              className={`w-full flex items-center justify-between px-3 py-4 rounded-2xl transition-all border-2 ${isActive('/instansi') ? 'border-gray-900 bg-gray-900 text-white font-bold shadow-lg shadow-gray-200' : 'border-transparent text-gray-800 hover:bg-gray-100 font-medium'}`}
            >
              <div className="flex items-center gap-3">
                 <Building2 size={20} className={isActive('/instansi') ? 'text-blue-400' : 'text-gray-500'}/> 
                 <div className="text-left">
                   <p className="text-sm">Invoice Instansi</p>
                   <p className="text-[9px] text-gray-400">Format Cetak A4</p>
                 </div>
              </div>
              <ChevronRight size={16} className="opacity-50" />
            </Link>
         </div>
      </div>
    </>
  );
};

export default Sidebar;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: use Link in Sidebar component"
```

### Task 5: Fix Thermal Print Alignment

**Files:**
- Modify: `src/components/ReceiptThermal.jsx`

- [ ] **Step 1: Add @media print styles**
  - Add a `<style>` block to handle print-specific formatting.
  - Set paper size to 58mm.
  - Hide non-printable elements.

```jsx
// ... inside ReceiptThermal component, before return:

  const printStyles = `
    @media print {
      @page {
        margin: 0;
        size: 58mm auto;
      }
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
      }
      .print-container {
        width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      * {
        color: black !important;
        background: white !important;
      }
    }
  `;

// ... update return statement to include style and classNames:

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md overflow-y-auto print:bg-white print:p-0 flex flex-col items-center no-print-overlay">
      <style>{printStyles}</style>
      <div className="w-full flex justify-center py-10 px-4 mb-32 print:p-0 print:m-0"> 
        <div className="print-container bg-white w-full max-w-[300px] relative flex flex-col font-mono text-black print:m-0 print:w-[58mm] print:shadow-none shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden h-fit">
          
          <div className="h-3 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSI1Ij48cG9seWdvbiBwb2ludHM9IjAsNSA1LDAgMTAsNSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x absolute -top-[1px] left-0 z-10 print:hidden"></div>

          <div className="p-6 print:p-2"> {/* Reduced padding for print */}
            {/* ... content ... */}
          </div>
          
          {/* ... bottom edge ... */}
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-[60] print:hidden w-full max-w-[300px] px-4 no-print">
        {/* ... buttons ... */}
      </div>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ReceiptThermal.jsx
git commit -m "fix: adjust thermal receipt for 58mm printing"
```
