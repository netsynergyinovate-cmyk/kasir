# Pelanggan Page Upgrade & Edit Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Customer page UI to a modern boxy-rounded style and implement an Edit Customer pop-up modal.

**Architecture:** Create a new `EditCustomerModal.jsx` component similar to the add modal. Update `App.jsx` to handle the Supabase `update` call. Refactor `Pelanggan.jsx` to manage the editing state and pass data to the modal.

**Tech Stack:** React, Supabase, Tailwind CSS, Lucide React.

---

### Task 1: Add Update Logic to App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `handleUpdateCustomerDB` function**

```javascript
// src/App.jsx
// Add this function near handleAddCustomerDB
  const handleUpdateCustomerDB = async (updatedCustomer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: updatedCustomer.name,
          nickname: updatedCustomer.nickname,
          address: updatedCustomer.address,
          package: updatedCustomer.package,
          due_date: updatedCustomer.dueDate
        })
        .eq('id', updatedCustomer.id);

      if (error) throw error;
      
      // Update local state
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c));
    } catch (e) {
      console.error('Error updating customer:', e);
      alert('Gagal memperbarui data pelanggan!');
    }
  };
```

- [ ] **Step 2: Pass the function to the Pelanggan route**

```javascript
// src/App.jsx
// Inside the <Route path="/customers" element={...}>
            <Route path="/customers" element={
              <Pelanggan 
                customers={customers} 
                packages={packages}
                setShowAddCustomer={setShowAddCustomer} 
                onDeleteCustomer={handleDeleteCustomerDB}
                onUpdateCustomer={handleUpdateCustomerDB}
              />
            } />
```

- [ ] **Step 3: Commit changes**
```bash
git add src/App.jsx
git commit -m "feat: add update customer logic to App state"
```

---

### Task 2: Create EditCustomerModal Component

**Files:**
- Create: `src/components/EditCustomerModal.jsx`

- [ ] **Step 1: Create the Modal Component**

```javascript
// src/components/EditCustomerModal.jsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const EditCustomerModal = ({ customer, packages = [], onClose, onSave }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nickname: '',
    address: '',
    package: '',
    dueDate: ''
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        id: customer.id,
        name: customer.name || '',
        nickname: customer.nickname || '',
        address: customer.address || '',
        package: customer.package || '',
        dueDate: customer.due_date || customer.dueDate || ''
      });
    }
  }, [customer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h2 className="font-bold text-lg">Edit Pelanggan</h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-lg transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
            <input required name="name" value={formData.name} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Panggilan</label>
            <input name="nickname" value={formData.nickname} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat</label>
            <textarea required name="address" value={formData.address} onChange={handleChange} rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Paket</label>
              <select required name="package" value={formData.package} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-700">
                <option value="">Pilih Paket...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.name}>{pkg.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tgl Jatuh Tempo</label>
              <input required name="dueDate" value={formData.dueDate} onChange={handleChange} type="number" min="1" max="31" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium" />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl mt-6 shadow-md hover:bg-blue-700 active:scale-95 transition-all">
            Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerModal;
```

- [ ] **Step 2: Commit changes**
```bash
git add src/components/EditCustomerModal.jsx
git commit -m "feat: add EditCustomerModal component"
```

---

### Task 3: Refactor Pelanggan Page UI & Integrate Modal

**Files:**
- Modify: `src/pages/Pelanggan.jsx`

- [ ] **Step 1: Import Modal, Add State, and Refactor UI**

```javascript
// src/pages/Pelanggan.jsx
import React, { useState } from 'react';
import { Search, PlusCircle, Wifi, Trash2, Pencil, MapPin } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';

const Pelanggan = ({ customers = [], packages = [], setShowAddCustomer, onDeleteCustomer, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.nickname && c.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveEdit = (updatedData) => {
    onUpdateCustomer(updatedData);
    setEditingCustomer(null);
  };

  return (
    <div className="p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      {/* Header and Search remain similar */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">Data Pelanggan</h2>
        <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200">
          <PlusCircle size={16} /> Tambah
        </button>
      </div>
      <div className="bg-white flex items-center p-2 rounded-xl border border-gray-200 shadow-sm">
        <Search size={20} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama, panggilan, atau alamat..." 
          className="bg-transparent border-none outline-none p-2 w-full text-sm" 
        />
      </div>

      <div className="space-y-3 mt-4">
        {filteredCustomers.length > 0 ? filteredCustomers.map((cust) => (
          <div key={cust.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm group">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold uppercase">
                  {cust.name.substring(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-gray-800 leading-tight">
                    {cust.name} {cust.nickname && <span className="text-gray-400 font-medium text-[11px]">({cust.nickname})</span>}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                    <Wifi size={10} className="text-blue-500" /> {cust.package}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 flex items-start gap-1">
                    <MapPin size={10} className="text-gray-400 mt-0.5 shrink-0" /> <span className="leading-tight">{cust.address}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className="bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-500">TGL <span className="text-red-500">{cust.due_date || cust.dueDate}</span></p>
                </div>
                <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                  <button 
                    onClick={() => setEditingCustomer(cust)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`Hapus pelanggan "${cust.name}" secara permanen? Semua riwayat tidak akan hilang tapi data pelanggan akan dihapus.`)) {
                        onDeleteCustomer(cust.id);
                      }
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-10 opacity-50 italic text-sm">Pelanggan tidak ditemukan...</div>
        )}
      </div>

      {editingCustomer && (
        <EditCustomerModal 
          customer={editingCustomer} 
          packages={packages} 
          onClose={() => setEditingCustomer(null)} 
          onSave={handleSaveEdit} 
        />
      )}
    </div>
  );
};

export default Pelanggan;
```

- [ ] **Step 2: Commit final changes**
```bash
git add src/pages/Pelanggan.jsx
git commit -m "feat: upgrade Pelanggan UI and integrate Edit modal"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Smoke Test**
1. Check if the customer list renders correctly with the new styling.
2. Click the Edit button on a customer. Ensure the modal opens and is pre-filled.
3. Modify some data and click Save.
4. Verify the UI updates immediately.
5. Verify the data is updated in the Supabase database.
