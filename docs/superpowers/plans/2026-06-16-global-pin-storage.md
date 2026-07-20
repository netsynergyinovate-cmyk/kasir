# Global PIN Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the master application PIN in the Supabase database (`company_settings`) instead of strictly local storage, allowing a single PIN across all devices.

**Architecture:** 
1. `App.jsx` checks if `company_settings` has an `app_pin`. 
2. If `app_pin` is null, show the PIN setup screen.
3. If `app_pin` exists, show the PIN unlock screen (unless the device already unlocked it in the current session/local storage).
4. `PinPad.jsx` will be updated to take `dbPin` as a prop and perform verification or setup via callback to `App.jsx`.

**Tech Stack:** React, Supabase, Tailwind CSS.

---

### Task 1: Update Database Schema & Initial State

**Files:**
- Modify: `supabase_schema.sql`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `app_pin` to schema and initial state**

```sql
-- In supabase_schema.sql, update company_settings:
create table if not exists company_settings (
  id int primary key default 1,
  name text,
  address text,
  phone text,
  logo_url text,
  admin_name text default 'Admin Utama',
  admin_fee bigint default 10000,
  app_pin text, -- NEW COLUMN
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
```

```javascript
// src/App.jsx
const INIT_COMPANY = {
  name: 'PT Net Synergy Inovate',
  address: 'Loading...',
  phone: '',
  logo: null,
  adminName: 'Admin',
  adminFee: 10000,
  appPin: null // Add this
};
```

- [ ] **Step 2: Update fetch logic in `App.jsx`**

```javascript
// src/App.jsx (inside fetchData)
        if (settingsData) {
          setCompanyInfo({
            name: settingsData.name,
            address: settingsData.address,
            phone: settingsData.phone,
            logo: settingsData.logo_url,
            adminName: settingsData.admin_name || 'Admin',
            adminFee: settingsData.admin_fee || 10000,
            appPin: settingsData.app_pin || null // Add this
          });
        }
```

- [ ] **Step 3: Commit changes**
```bash
git add supabase_schema.sql src/App.jsx
git commit -m "feat: add app_pin to database schema and app state"
```

---

### Task 2: Refactor PinPad.jsx for DB Integration

**Files:**
- Modify: `src/components/PinPad.jsx`

- [ ] **Step 1: Modify PinPad to accept and verify against `dbPin`**

```javascript
// src/components/PinPad.jsx
import React, { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Import if needed for reset/logout

const PinPad = ({ mode = 'unlock', dbPin, onUnlock, onSetup }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(mode === 'setup' ? 'create' : 'enter'); // 'create', 'confirm', 'enter'
  const [error, setError] = useState(null);

  const PIN_LENGTH = 6;

  // Simple hash function for security (SHA-256)
  const hashPin = async (rawPin) => {
    const msgUint8 = new TextEncoder().encode(rawPin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    const processPin = async () => {
      if (pin.length === PIN_LENGTH) {
        if (step === 'create') {
          setTimeout(() => {
            setConfirmPin(pin);
            setPin('');
            setStep('confirm');
          }, 300);
        } else if (step === 'confirm') {
          if (pin === confirmPin) {
            const hashed = await hashPin(pin);
            onSetup(hashed); // Pass hash back to App.jsx to save in DB
          } else {
            setError('PIN tidak cocok. Ulangi kembali.');
            setPin('');
            setConfirmPin('');
            setStep('create');
            setTimeout(() => setError(null), 3000);
          }
        } else if (step === 'enter') {
          const hashedInput = await hashPin(pin);
          if (hashedInput === dbPin) { // Compare with DB Pin instead of localStorage
            // Save to localStorage just to remember this device is unlocked
            localStorage.setItem('device_unlocked', 'true'); 
            onUnlock();
          } else {
            setError('PIN Salah!');
            setPin('');
            setTimeout(() => setError(null), 2000);
          }
        }
      }
    };
    processPin();
  }, [pin, step, confirmPin, onSetup, onUnlock, dbPin]);

  const handleKeyPress = (num) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < PIN_LENGTH; i++) {
      dots.push(
        <div 
          key={i} 
          className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-blue-600 scale-110' : 'bg-gray-200'}`}
        />
      );
    }
    return dots;
  };

  const padNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    // ... JSX Remains identical to previous PinPad.jsx ...
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10 duration-300">
      <div className="flex flex-col items-center w-full max-w-sm">
        
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
           {step === 'enter' ? <Lock size={32} /> : <Fingerprint size={32} />}
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">
          {step === 'create' && 'Buat PIN Aplikasi'}
          {step === 'confirm' && 'Konfirmasi PIN'}
          {step === 'enter' && 'Masukkan PIN'}
        </h2>
        <p className="text-gray-500 text-sm font-medium mb-10 text-center">
          {step === 'create' && 'Buat Master PIN untuk aplikasi ini.'}
          {step === 'confirm' && 'Masukkan kembali PIN yang baru saja dibuat.'}
          {step === 'enter' && 'Buka kunci aplikasi KAsir.'}
        </p>

        <div className="flex gap-4 mb-12 justify-center h-4">
          {renderDots()}
        </div>

        {error && (
          <div className="text-red-500 text-sm font-bold absolute top-10 bg-red-50 px-4 py-2 rounded-full animate-in fade-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full max-w-[280px]">
          {padNumbers.map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-full aspect-square bg-gray-50 rounded-2xl text-2xl font-bold text-gray-800 hover:bg-gray-100 active:bg-blue-100 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-gray-100"
            >
              {num}
            </button>
          ))}
          <div className="w-full aspect-square"></div> {/* Empty space */}
          <button
            onClick={() => handleKeyPress('0')}
            className="w-full aspect-square bg-gray-50 rounded-2xl text-2xl font-bold text-gray-800 hover:bg-gray-100 active:bg-blue-100 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-gray-100"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-full aspect-square bg-red-50/50 rounded-2xl text-red-500 hover:bg-red-50 active:bg-red-100 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-red-50"
          >
            <Delete size={28} />
          </button>
        </div>
        
        {step === 'enter' && (
          <button 
            onClick={async () => {
              localStorage.removeItem('device_unlocked');
              await supabase.auth.signOut();
              window.location.reload();
            }} 
            className="mt-12 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
          >
            Keluar (Logout)
          </button>
        )}
      </div>
    </div>
  );
};

export default PinPad;
```

- [ ] **Step 2: Commit changes**
```bash
git add src/components/PinPad.jsx
git commit -m "refactor: update PinPad to use DB pin and handle session state"
```

---

### Task 3: Refactor Auth Flow in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update Auth state logic in App.jsx**

```javascript
// src/App.jsx
// Replace existing checkPinState, handlePinSetup, handleUnlock with:

  const handlePinSetup = async (hashedPin) => {
    try {
      const { error } = await supabase.from('company_settings').upsert({
        id: 1,
        app_pin: hashedPin
      });
      if (error) throw error;
      setCompanyInfo({ ...companyInfo, appPin: hashedPin });
      localStorage.setItem('device_unlocked', 'true');
      setIsLocked(false);
    } catch (e) {
      console.error('Error saving PIN to DB:', e);
      alert('Gagal menyimpan PIN.');
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  // We determine 'isLocked' based on whether they have a session, 
  // if the DB has a pin, and if this specific device is "unlocked"
  useEffect(() => {
    if (session && !isLoading) {
      const isDeviceUnlocked = localStorage.getItem('device_unlocked') === 'true';
      if (!isDeviceUnlocked && companyInfo.appPin) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    }
  }, [session, companyInfo.appPin, isLoading]);

```

- [ ] **Step 2: Update Conditional Rendering in App.jsx**

```javascript
// src/App.jsx
// Update the return statement rendering:

  if (!session) {
    return <Login />;
  }

  // If session exists, data is loaded, but no DB Pin exists -> Setup mode
  if (session && !isLoading && !companyInfo.appPin) {
    return <PinPad mode="setup" onSetup={handlePinSetup} />;
  }

  // If session exists, DB Pin exists, but device is locked -> Unlock mode
  if (session && !isLoading && companyInfo.appPin && isLocked) {
    return <PinPad mode="unlock" dbPin={companyInfo.appPin} onUnlock={handleUnlock} />;
  }

  return (
    <div className={`min-h-screen font-sans ${receiptToView || instansiReceiptToView ? 'print-container' : ''}`}>
// ...
```

- [ ] **Step 3: Update handleLogout in Settings.jsx**

```javascript
// src/pages/Settings.jsx
// Update handleLogout to remove the new flag
  const handleLogout = async () => {
    if (window.confirm('Yakin ingin keluar dari aplikasi? Anda harus memasukkan PIN kembali saat masuk.')) {
      localStorage.removeItem('device_unlocked');
      await supabase.auth.signOut();
      window.location.reload();
    }
  };
```

- [ ] **Step 4: Commit changes**
```bash
git add src/App.jsx src/pages/Settings.jsx
git commit -m "feat: complete global DB pin integration"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Smoke Test**
1. Run SQL `ALTER TABLE company_settings ADD COLUMN app_pin TEXT;` in Supabase to prepare DB.
2. Login to the app. 
3. App should prompt to create PIN. Create it.
4. Verify `app_pin` is saved in Supabase `company_settings`.
5. Open an incognito window, login with the same account.
6. App should NOT ask to create a PIN, but should ask to ENTER the PIN.
7. Enter correct PIN -> access granted.
