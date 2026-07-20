# Pelanggan View Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a toggleable view (Grid/Widget vs List/Table) for the Pelanggan page.

**Architecture:** Add a `viewMode` state to `Pelanggan.jsx`. Create conditional rendering blocks for both the Grid layout and the List layout, mapping over the `filteredCustomers` array for each. Update the header to include the toggle buttons.

**Tech Stack:** React, Tailwind CSS, Lucide React.

---

### Task 1: Add State and Toggle UI

**Files:**
- Modify: `src/pages/Pelanggan.jsx`

- [ ] **Step 1: Add state and icons, update header JSX**

```javascript
// src/pages/Pelanggan.jsx
import React, { useState } from 'react';
import { Search, PlusCircle, Wifi, Trash2, Pencil, MapPin, LayoutGrid, List, Calendar } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';

// Inside Pelanggan component
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

// Update the return JSX header area
  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Data Pelanggan</h2>
        <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200">
          <PlusCircle size={16} /> Tambah
        </button>
      </div>
      
      {/* Search and Toggle Row */}
      <div className="flex gap-2">
        <div className="bg-white flex-1 flex items-center p-2 rounded-xl border border-gray-200 shadow-sm">
          <Search size={20} className="text-gray-400 ml-2" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, panggilan, atau alamat..." 
            className="bg-transparent border-none outline-none p-2 w-full text-sm" 
          />
        </div>
        <div className="bg-white flex items-center p-1 rounded-xl border border-gray-200 shadow-sm">
           <button 
             onClick={() => setViewMode('grid')}
             className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
           >
             <LayoutGrid size={18} />
           </button>
           <button 
             onClick={() => setViewMode('list')}
             className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
           >
             <List size={18} />
           </button>
        </div>
      </div>
```

- [ ] **Step 2: Commit changes**
```bash
git add src/pages/Pelanggan.jsx
git commit -m "feat: add viewMode state and toggle UI to Pelanggan"
```

---

### Task 2: Implement Grid and List Render Logic

**Files:**
- Modify: `src/pages/Pelanggan.jsx`

- [ ] **Step 1: Replace the customer list mapping with conditional rendering**

```javascript
// src/pages/Pelanggan.jsx (continued)

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-10 opacity-50 italic text-sm">Pelanggan tidak ditemukan...</div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW (Widget) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {filteredCustomers.map((cust) => (
            <div key={cust.id} className={`bg-white p-5 rounded-xl border shadow-sm relative group hover:shadow-md transition-all ${cust.status !== 'aktif' ? 'border-red-100 bg-red-50/20' : 'border-gray-200'}`}>
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14}/></button>
                <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
              </div>
              
              <div className="flex flex-col items-center text-center mb-4 pt-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl mb-3 ${cust.status === 'aktif' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'} border`}>
                  {cust.name.substring(0, 2).toUpperCase()}
                </div>
                <h3 className="font-bold text-gray-900 leading-tight">{cust.name} {cust.nickname && <span className="text-gray-400 font-medium text-xs">({cust.nickname})</span>}</h3>
                <p className="text-[10px] text-gray-500 mt-1">ID: {cust.id}</p>
                <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${cust.status === 'aktif' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}`}></span> {cust.status}
                </span>
              </div>
              
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5"><Wifi size={12}/> Paket</span>
                  <span className="font-medium text-gray-800">{cust.package}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5"><Calendar size={12}/> Bayar</span>
                  <span className="font-medium text-gray-800">Tgl {cust.due_date || cust.dueDate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW (Table) */
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-4">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <div className="col-span-5">Pelanggan</div>
              <div className="col-span-4">Paket & Lokasi</div>
              <div className="col-span-2 text-center">Status</div>
              <div class="col-span-1 text-right">Aksi</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredCustomers.map((cust) => (
              <div key={cust.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-gray-50 transition-colors group ${cust.status !== 'aktif' ? 'bg-red-50/10' : ''}`}>
                <div className="col-span-1 sm:col-span-5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${cust.status === 'aktif' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {cust.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 leading-none mb-1">{cust.name} {cust.nickname && <span className="text-gray-400 font-medium text-[10px]">({cust.nickname})</span>}</p>
                        <p className="text-[10px] text-gray-500">ID: {cust.id} • Tgl: {cust.due_date || cust.dueDate}</p>
                    </div>
                </div>
                <div className="col-span-1 sm:col-span-4">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Wifi size={12} className="text-blue-500"/>
                        <span className="text-[11px] font-bold text-gray-700">{cust.package}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                        <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0"/>
                        <span className="text-[10px] text-gray-500 truncate">{cust.address}</span>
                    </div>
                </div>
                <div className="col-span-1 sm:col-span-2 flex sm:justify-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${cust.status === 'aktif' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cust.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}`}></span> {cust.status}
                    </span>
                </div>
                <div className="col-span-1 sm:col-span-1 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil size={14}/></button>
                    <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Commit final changes**
```bash
git add src/pages/Pelanggan.jsx
git commit -m "feat: implement grid and list view rendering for Pelanggan"
```

---

### Task 3: Final Verification

- [ ] **Step 1: Smoke Test**
1. Check if the toggle buttons are visible.
2. Click 'Grid' -> Verify widget layout is displayed correctly.
3. Click 'List' -> Verify table layout is displayed correctly.
4. Verify responsive design on both views.
5. Verify Edit and Delete buttons work in both views.
