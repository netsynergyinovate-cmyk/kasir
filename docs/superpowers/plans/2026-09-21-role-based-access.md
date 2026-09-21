# Role-Based Access (Superadmin vs Admin) + Device Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti sistem login hardcoded/localStorage yang sekarang dengan Supabase Auth asli + tabel `admin_profiles`, tegakkan akses superadmin (penuh) vs admin (transaksi, pelanggan, printer) lewat RLS Postgres sungguhan (bukan cuma sembunyi UI), dan kunci akun admin ke 1 device sampai superadmin mereset.

**Architecture:** Supabase Auth menjadi satu-satunya sumber identitas; tabel `admin_profiles` (1-ke-1 dengan `auth.users`) menyimpan `role`, `device_id`, `device_label`. RLS policy Postgres membaca `auth.uid()` lewat fungsi `current_role_is_superadmin()` untuk menolak tulis di tabel sensitif kalau bukan superadmin. Pembuatan akun admin baru lewat 1 Vercel Function yang pakai `service_role` key (tidak pernah ke frontend). Frontend menyembunyikan menu/section sesuai role DAN melakukan route-guard, sebagai lapisan UX di atas RLS (bukan pengganti RLS).

**Tech Stack:** React 19 + Vite 8 + react-router-dom 7, Supabase (Postgres + Auth), Vercel Functions (Node.js), Vitest untuk unit test logic murni.

## Global Constraints

- Spesifikasi acuan: `docs/superpowers/specs/2026-09-21-role-based-access-design.md`
- `service_role` key Supabase HANYA boleh ada di environment variable server-side Vercel (nama tanpa prefix `VITE_`), TIDAK PERNAH di kode frontend/`src/`.
- Setiap tabel yang sekarang RLS mati (`customers`, `packages`, `transactions`, `company_settings`) WAJIB diaktifkan RLS-nya di migrasi ini.
- `ping_logs` tetap RLS terbuka penuh (dipakai `scripts/ping-supabase.js` via GitHub Actions tanpa login Supabase Auth — lihat commit `a3cdf8e`/workflow `.github/workflows/supabase-keepalive.yml`).
- Hanya 1 akun superadmin untuk saat ini (sesuai keputusan di spec).
- Fingerprint device berbasis `localStorage` (UUID persisten), bukan ID hardware asli — keterbatasan yang sudah disetujui di spec.
- Hardcoded credentials (`admin@kasir.com`/`superadmin@kasir.com`) dan fitur daftar-sendiri (`kasir_registered_users`) DIHAPUS total dari `src/pages/Login.jsx`.

---

## Task 1: Setup Vitest Test Runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `src/utils/__tests__/smoke.test.js`

**Interfaces:**
- Produces: perintah `npm test` yang menjalankan Vitest sekali (`vitest run`), environment `jsdom`, mode `globals: true` (supaya `describe`/`it`/`expect` tidak perlu diimpor manual di task berikutnya).

- [ ] **Step 1: Install dependency**

Run: `npm install -D vitest jsdom`

- [ ] **Step 2: Buat konfigurasi Vitest**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 3: Tambah script test di package.json**

Modify `package.json` — tambahkan baris `"test"` di objek `scripts` (setelah `"preview": "vite preview",`):
```json
    "preview": "vite preview",
    "test": "vitest run",
    "ping-db": "node scripts/ping-supabase.js"
```

- [ ] **Step 4: Tulis test smoke sederhana**

Create `src/utils/__tests__/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Jalankan dan pastikan lulus**

Run: `npm test`
Expected: 1 file, 1 test, PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/utils/__tests__/smoke.test.js
git commit -m "chore: setup vitest test runner"
```

---

## Task 2: Utility `deviceId.js` (Fingerprint Device)

**Files:**
- Create: `src/utils/deviceId.js`
- Test: `src/utils/__tests__/deviceId.test.js`

**Interfaces:**
- Produces: `getOrCreateDeviceId(): string`, `getDeviceLabel(): string` — dipakai oleh `src/pages/Login.jsx` (Task 6) dan `src/components/AdminAccountsPanel.jsx` (Task 10) untuk membaca label device yang sudah tersimpan di `admin_profiles.device_label` (label itu sendiri dibuat oleh fungsi ini saat login pertama).

- [ ] **Step 1: Tulis test yang gagal**

Create `src/utils/__tests__/deviceId.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrCreateDeviceId, getDeviceLabel } from '../deviceId';

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates and persists a device id on first call', () => {
    const id = getOrCreateDeviceId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem('kasir_device_id')).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });
});

describe('getDeviceLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels a Chrome-on-Windows user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });
    expect(getDeviceLabel()).toBe('Chrome di Windows');
  });

  it('labels a Safari-on-iPhone user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(getDeviceLabel()).toBe('Safari di iOS');
  });

  it('falls back to a generic label for an unknown user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'SomeWeirdBot/1.0' });
    expect(getDeviceLabel()).toBe('Browser Tidak Dikenal di OS Tidak Dikenal');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- deviceId`
Expected: FAIL — `Cannot find module '../deviceId'` (file belum ada).

- [ ] **Step 3: Implementasi**

Create `src/utils/deviceId.js`:
```js
const DEVICE_ID_KEY = 'kasir_device_id';

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceLabel() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';

  let browser = 'Browser Tidak Dikenal';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'OS Tidak Dikenal';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} di ${os}`;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm test -- deviceId`
Expected: 4 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/deviceId.js src/utils/__tests__/deviceId.test.js
git commit -m "feat: tambah utility fingerprint device untuk device-lock admin"
```

---

## Task 3: Utility `permissions.js` (Route Allow-List per Role)

**Files:**
- Create: `src/utils/permissions.js`
- Test: `src/utils/__tests__/permissions.test.js`

**Interfaces:**
- Produces: `ADMIN_ALLOWED_PATHS: string[]`, `ADMIN_DEFAULT_PATH: string`, `isPathAllowedForRole(role: string, pathname: string): boolean` — dipakai `src/App.jsx` (Task 7) untuk route-guard.

- [ ] **Step 1: Tulis test yang gagal**

Create `src/utils/__tests__/permissions.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { isPathAllowedForRole, ADMIN_ALLOWED_PATHS, ADMIN_DEFAULT_PATH } from '../permissions';

describe('isPathAllowedForRole', () => {
  it('allows superadmin on any path', () => {
    expect(isPathAllowedForRole('superadmin', '/instansi')).toBe(true);
    expect(isPathAllowedForRole('superadmin', '/aktivitas')).toBe(true);
    expect(isPathAllowedForRole('superadmin', '/pos')).toBe(true);
  });

  it('allows admin only on the allow-listed paths', () => {
    ADMIN_ALLOWED_PATHS.forEach((path) => {
      expect(isPathAllowedForRole('admin', path)).toBe(true);
    });
  });

  it('blocks admin on paths outside the allow-list', () => {
    expect(isPathAllowedForRole('admin', '/')).toBe(false);
    expect(isPathAllowedForRole('admin', '/instansi')).toBe(false);
    expect(isPathAllowedForRole('admin', '/aktivitas')).toBe(false);
    expect(isPathAllowedForRole('admin', '/history')).toBe(false);
  });

  it('exposes /pos as the admin default landing path', () => {
    expect(ADMIN_DEFAULT_PATH).toBe('/pos');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- permissions`
Expected: FAIL — `Cannot find module '../permissions'`.

- [ ] **Step 3: Implementasi**

Create `src/utils/permissions.js`:
```js
export const ADMIN_ALLOWED_PATHS = ['/pos', '/customers', '/settings'];
export const ADMIN_DEFAULT_PATH = '/pos';

export function isPathAllowedForRole(role, pathname) {
  if (role === 'superadmin') return true;
  return ADMIN_ALLOWED_PATHS.includes(pathname);
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm test -- permissions`
Expected: 4 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/permissions.js src/utils/__tests__/permissions.test.js
git commit -m "feat: tambah utility allow-list route per role"
```

---

## Task 4: Migrasi SQL — `admin_profiles` + RLS Penuh + Fix Keep-Alive Script

**Files:**
- Create: `supabase_role_based_access.sql`
- Modify: `scripts/ping-supabase.js`

**Interfaces:**
- Produces: tabel `admin_profiles(id, full_name, role, device_id, device_label, created_at)`, fungsi Postgres `current_role_is_superadmin()`, RLS policy di `admin_profiles`, `customers`, `transactions`, `packages`, `company_settings`, `ping_logs`.
- Konsumen: Task 5 (bootstrap superadmin), Task 6 (`Login.jsx` query `admin_profiles`), Task 10 (`AdminAccountsPanel.jsx` query/update `admin_profiles`), Task 11 (Vercel Function insert ke `admin_profiles` via service_role, bypass RLS).

**Konteks penting:** RLS baru mewajibkan `auth.uid() is not null` untuk SELECT di `customers`. Script keep-alive (`scripts/ping-supabase.js`, dipanggil `.github/workflows/supabase-keepalive.yml` tiap 24 jam) memakai *anon key* TANPA login Supabase Auth, jadi query lamanya ke `customers` harus dipindah ke `ping_logs` (yang sengaja tetap terbuka).

- [ ] **Step 1: Tulis file migrasi SQL**

Create `supabase_role_based_access.sql`:
```sql
-- ==========================================
-- MIGRASI: Role-Based Access (Superadmin vs Admin) + Device Lock
-- Tanggal: 2026-09-21
-- Jalankan seluruh isi file ini di Supabase SQL Editor, satu kali.
-- ==========================================

-- 1. Tabel admin_profiles (terhubung ke auth.users bawaan Supabase Auth)
create table if not exists admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'superadmin')),
  device_id text,
  device_label text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 2. Fungsi bantu: cek apakah pemanggil saat ini superadmin.
-- security definer supaya bisa membaca admin_profiles tanpa terjebak RLS-nya sendiri.
create or replace function public.current_role_is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

-- 3. RLS: admin_profiles
alter table admin_profiles enable row level security;

drop policy if exists "profiles select own or superadmin all" on admin_profiles;
create policy "profiles select own or superadmin all"
on admin_profiles for select
using (id = auth.uid() or current_role_is_superadmin());

drop policy if exists "profiles superadmin update any" on admin_profiles;
create policy "profiles superadmin update any"
on admin_profiles for update
using (current_role_is_superadmin())
with check (current_role_is_superadmin());

-- Catatan: sengaja tidak ada policy INSERT/DELETE untuk admin_profiles dari sisi client.
-- Pembuatan akun admin baru hanya lewat Vercel Function yang pakai service_role key
-- (service_role otomatis melewati RLS, lihat Task 11).

-- 4. RLS: customers
alter table customers enable row level security;
drop policy if exists "Enable public access for customers" on customers;
drop policy if exists "customers select logged in" on customers;
create policy "customers select logged in" on customers for select using (auth.uid() is not null);
drop policy if exists "customers insert logged in" on customers;
create policy "customers insert logged in" on customers for insert with check (auth.uid() is not null);
drop policy if exists "customers update superadmin" on customers;
create policy "customers update superadmin" on customers for update using (current_role_is_superadmin()) with check (current_role_is_superadmin());
drop policy if exists "customers delete superadmin" on customers;
create policy "customers delete superadmin" on customers for delete using (current_role_is_superadmin());

-- 5. RLS: transactions
alter table transactions enable row level security;
drop policy if exists "Enable public access for transactions" on transactions;
drop policy if exists "transactions select logged in" on transactions;
create policy "transactions select logged in" on transactions for select using (auth.uid() is not null);
drop policy if exists "transactions insert logged in" on transactions;
create policy "transactions insert logged in" on transactions for insert with check (auth.uid() is not null);
drop policy if exists "transactions update superadmin" on transactions;
create policy "transactions update superadmin" on transactions for update using (current_role_is_superadmin()) with check (current_role_is_superadmin());
drop policy if exists "transactions delete superadmin" on transactions;
create policy "transactions delete superadmin" on transactions for delete using (current_role_is_superadmin());

-- 6. RLS: packages (select untuk semua yang login, insert/update/delete superadmin saja)
alter table packages enable row level security;
drop policy if exists "Enable public access for packages" on packages;
drop policy if exists "packages select logged in" on packages;
create policy "packages select logged in" on packages for select using (auth.uid() is not null);
drop policy if exists "packages write superadmin" on packages;
create policy "packages write superadmin" on packages for all using (current_role_is_superadmin()) with check (current_role_is_superadmin());

-- 7. RLS: company_settings (select untuk semua yang login, tulis superadmin saja)
alter table company_settings enable row level security;
drop policy if exists "Enable public access for company_settings" on company_settings;
drop policy if exists "company_settings select logged in" on company_settings;
create policy "company_settings select logged in" on company_settings for select using (auth.uid() is not null);
drop policy if exists "company_settings write superadmin" on company_settings;
create policy "company_settings write superadmin" on company_settings for all using (current_role_is_superadmin()) with check (current_role_is_superadmin());

-- 8. RLS: ping_logs — SENGAJA tetap terbuka penuh.
-- Dipakai oleh GitHub Actions (scripts/ping-supabase.js) & keep-alive client (src/lib/supabase.js)
-- TANPA login Supabase Auth. Tabel ini tidak menyimpan data sensitif (cuma timestamp+source).
alter table ping_logs enable row level security;
drop policy if exists "Enable public access for ping_logs" on ping_logs;
drop policy if exists "ping_logs public access" on ping_logs;
create policy "ping_logs public access" on ping_logs for all using (true) with check (true);
```

- [ ] **Step 2: Jalankan migrasi di Supabase**

Buka Supabase Dashboard proyek ini → **SQL Editor** → paste seluruh isi `supabase_role_based_access.sql` → **Run**.
Expected: tidak ada error; pesan "Success. No rows returned".

- [ ] **Step 3: Verifikasi RLS aktif**

Run di SQL Editor yang sama:
```sql
select tablename, rowsecurity
from pg_tables
where tablename in ('admin_profiles','customers','transactions','packages','company_settings','ping_logs');
```
Expected: kolom `rowsecurity` bernilai `true` untuk keenam baris.

- [ ] **Step 4: Perbaiki target ping keep-alive**

Modify `scripts/ping-supabase.js` — ganti fungsi `pingSupabase` (baris 35-64) supaya menembak `ping_logs` (insert), bukan `customers` (select yang sekarang butuh login):

Old:
```js
async function pingSupabase() {
  console.log(`📡 Menghubungi Supabase API di: ${supabaseUrl}`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/customers?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
```

New:
```js
async function pingSupabase() {
  console.log(`📡 Menghubungi Supabase API di: ${supabaseUrl}`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/ping_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ source: 'github_action' })
    });
```

Sisa fungsi (pengecekan `response.ok`, log sukses/gagal) tidak berubah.

- [ ] **Step 5: Uji manual script keep-alive**

Run: `npm run ping-db`
Expected: output `✅ Supabase Ping Berhasil! (...ms) - Database tetap aktif.`

- [ ] **Step 6: Commit**

```bash
git add supabase_role_based_access.sql scripts/ping-supabase.js
git commit -m "feat: migrasi admin_profiles + aktifkan RLS penuh, fix target keep-alive ke ping_logs"
```

---

## Task 5: Bootstrap Akun Superadmin Pertama

**Files:** Tidak ada file kode — langkah manual di Supabase Dashboard + 1 query SQL.

**Interfaces:**
- Produces: 1 baris `auth.users` + 1 baris `admin_profiles` dengan `role = 'superadmin'`, dipakai untuk login pertama kali setelah Task 6-9 dideploy.

- [ ] **Step 1: Buat user di Supabase Auth**

Buka Supabase Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**:
- Email: `netsynergyinovate@gmail.com`
- Password: (password yang sudah diberikan pemilik aplikasi — tidak dicatat di file ini)
- Centang **Auto Confirm User** (supaya tidak perlu verifikasi email).
- Klik **Create user**.

- [ ] **Step 2: Hubungkan ke admin_profiles sebagai superadmin**

Buka **SQL Editor**, run:
```sql
insert into admin_profiles (id, full_name, role)
select id, 'Super Administrator', 'superadmin'
from auth.users
where email = 'netsynergyinovate@gmail.com'
on conflict (id) do update set role = 'superadmin', full_name = 'Super Administrator';
```

- [ ] **Step 3: Verifikasi**

Run:
```sql
select u.email, p.role, p.full_name
from admin_profiles p
join auth.users u on u.id = p.id;
```
Expected: 1 baris, `email = netsynergyinovate@gmail.com`, `role = superadmin`.

(Tidak ada commit git — task ini murni operasi di Supabase, tidak mengubah file repo.)

---

## Task 6: Rewrite `src/pages/Login.jsx` — Supabase Auth + Device Lock

**Files:**
- Modify: `src/pages/Login.jsx` (rewrite penuh, 543 baris → jauh lebih pendek)

**Interfaces:**
- Consumes: `getOrCreateDeviceId()`, `getDeviceLabel()` dari `../utils/deviceId` (Task 2); tabel `admin_profiles` (Task 4).
- Produces: `onLoginSuccess(sessionWithProfile)` dipanggil dengan objek `{ ...supabaseSession, profile: { id, full_name, role, device_id, device_label } }` — bentuk ini dikonsumsi `src/App.jsx` (Task 7) sebagai `session.profile.role` dan `session.profile.full_name`.

- [ ] **Step 1: Ganti seluruh isi file**

Replace seluruh isi `src/pages/Login.jsx` dengan:
```jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react';
import { getOrCreateDeviceId, getDeviceLabel } from '../utils/deviceId';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data?.session) {
        throw new Error('Email atau password salah.');
      }

      const userId = data.session.user.id;
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('id, full_name, role, device_id, device_label')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Akun ini belum terdaftar sebagai admin/superadmin di sistem.');
      }

      if (profile.role === 'admin') {
        const currentDeviceId = getOrCreateDeviceId();
        const currentDeviceLabel = getDeviceLabel();

        if (!profile.device_id) {
          const { error: bindError } = await supabase
            .from('admin_profiles')
            .update({ device_id: currentDeviceId, device_label: currentDeviceLabel })
            .eq('id', userId);

          if (bindError) {
            await supabase.auth.signOut();
            throw new Error('Gagal mengunci akun ke device ini: ' + bindError.message);
          }

          profile.device_id = currentDeviceId;
          profile.device_label = currentDeviceLabel;
        } else if (profile.device_id !== currentDeviceId) {
          await supabase.auth.signOut();
          throw new Error('Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device.');
        }
      }

      if (onLoginSuccess) onLoginSuccess({ ...data.session, profile });
    } catch (err) {
      setError(err.message || 'Gagal login. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-3">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">KAsir NetSI</h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium mt-0.5 text-center">Sistem Kasir & Billing ISP POS</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl text-xs font-bold mb-4 text-center border border-red-100 animate-in shake duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                placeholder="nama@usaha.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'MASUK SEKARANG'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
```

- [ ] **Step 2: Jalankan lint**

Run: `npm run lint`
Expected: tidak ada error baru terkait `Login.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: ganti Login.jsx ke Supabase Auth murni + device-lock admin"
```

(Verifikasi fungsional penuh dilakukan di Task 12 setelah App.jsx/Sidebar.jsx ikut diupdate — login tidak bisa dites utuh sebelum Task 7 selesai karena App.jsx belum tahu cara membaca `session.profile`.)

---

## Task 7: Update `src/App.jsx` — Profile State, Route Guard, PIN Bypass Admin

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `isPathAllowedForRole`, `ADMIN_DEFAULT_PATH` dari `./utils/permissions` (Task 3); `session.profile` yang dikirim `Login.jsx` (Task 6).
- Produces: `session` state sekarang selalu berbentuk `{ ...supabaseSession, profile: { id, full_name, role, device_id, device_label } | null }`, dipakai `Sidebar.jsx` (Task 8), `Settings.jsx` (Task 9), `Pelanggan.jsx` (Task 9), `Transaksi.jsx` (Task 9).

- [ ] **Step 1: Tambah import**

Modify `src/App.jsx:2` — tambah `useNavigate, useLocation`:

Old:
```js
import { Routes, Route } from 'react-router-dom';
```
New:
```js
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
```

Modify `src/App.jsx:6` — tambah import permissions setelah baris `billingApi`:

Old:
```js
import { sendPaymentToBillingSystem, fetchCustomersFromEbilling } from './utils/billingApi';
```
New:
```js
import { sendPaymentToBillingSystem, fetchCustomersFromEbilling } from './utils/billingApi';
import { isPathAllowedForRole, ADMIN_DEFAULT_PATH } from './utils/permissions';
```

- [ ] **Step 2: Ganti effect bootstrap session (baris 107-138)**

Old (`src/App.jsx:107-138`):
```js
  useEffect(() => {
    // 1. Cek apakah ada sesi akun kasir yang aktif
    const savedUser = localStorage.getItem('kasir_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && (parsed.email || parsed.role || parsed.id)) {
          setSession({ user: parsed });
        } else {
          setSession(null);
        }
      } catch (e) {
        console.error('Error parsing kasir_user from storage:', e);
        setSession(null);
      }
    } else {
      // Jika belum ada user yang login, tampilkan halaman Login
      setSession(null);
    }

    // 2. Hubungkan listener Supabase Auth jika ada user aktif
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (authSession && localStorage.getItem('kasir_user')) {
        setSession(authSession);
        localStorage.setItem('kasir_user', JSON.stringify(authSession.user));
      } else if (!localStorage.getItem('kasir_user')) {
        setSession(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);
```

New:
```js
  useEffect(() => {
    let isMounted = true;

    const loadProfile = async (authSession) => {
      if (!authSession) {
        if (isMounted) setSession(null);
        return;
      }
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('id, full_name, role, device_id, device_label')
        .eq('id', authSession.user.id)
        .maybeSingle();

      if (isMounted) setSession({ ...authSession, profile: profile || null });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        loadProfile(data.session);
      } else if (isMounted) {
        setSession(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_OUT') {
        if (isMounted) setSession(null);
        return;
      }
      loadProfile(authSession);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);
```

- [ ] **Step 3: Tambah route guard (setelah effect isLocked, sebelum effect fetchData)**

Modify `src/App.jsx` — sisipkan hook baru tepat sebelum `useEffect(() => { if (!session) {...` (baris 172 di versi lama, cari baris `const fetchData = async () => {` sebagai penanda). Tambahkan `useNavigate`/`useLocation` di deklarasi state (setelah baris `const [session, setSession] = useState(null);`) dan effect guard-nya:

Old (`src/App.jsx:38-40`):
```js
export default function App() {
  const [session, setSession] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
```
New:
```js
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
```

Tambahkan hook baru tepat setelah blok `useEffect` penentu `isLocked` (baris 161-170 versi lama, lihat Step 4 di bawah untuk isi barunya) — letakkan effect route-guard ini setelahnya:
```js
  useEffect(() => {
    if (session?.profile?.role === 'admin' && !isPathAllowedForRole('admin', location.pathname)) {
      navigate(ADMIN_DEFAULT_PATH, { replace: true });
    }
  }, [session, location.pathname, navigate]);
```

- [ ] **Step 4: Bypass PIN untuk role admin (device-lock sudah jadi pengaman mereka)**

Modify `src/App.jsx:161-170` — effect penentu `isLocked`:

Old:
```js
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
New:
```js
  useEffect(() => {
    if (session && !isLoading) {
      if (session.profile?.role === 'admin') {
        setIsLocked(false);
        return;
      }
      const isDeviceUnlocked = localStorage.getItem('device_unlocked') === 'true';
      if (!isDeviceUnlocked && companyInfo.appPin) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    }
  }, [session, companyInfo.appPin, isLoading]);
```

Modify `src/App.jsx:655` (kondisi render `PinPad mode="setup"`):

Old:
```js
  if (session && !isLoading && !companyInfo.appPin && localStorage.getItem('bypass_pin') !== 'true') {
```
New:
```js
  if (session && !isLoading && session.profile?.role !== 'admin' && !companyInfo.appPin && localStorage.getItem('bypass_pin') !== 'true') {
```

Modify `src/App.jsx:670` (kondisi render `PinPad mode="unlock"`):

Old:
```js
  if (session && !isLoading && companyInfo.appPin && isLocked) {
```
New:
```js
  if (session && !isLoading && session.profile?.role !== 'admin' && companyInfo.appPin && isLocked) {
```

- [ ] **Step 5: Teruskan role ke Pelanggan**

Modify `src/App.jsx` — di dalam `<Route path="/customers" .../>` (baris 746-755), tambahkan prop `role`:

Old:
```jsx
            <Route path="/customers" element={
              <Pelanggan 
                customers={customers} 
                packages={packages}
                setShowAddCustomer={setShowAddCustomer} 
                onDeleteCustomer={handleDeleteCustomerDB}
                onUpdateCustomer={handleUpdateCustomerDB}
                onSyncEbilling={handleSyncCustomersFromEbilling}
              />
            } />
```
New:
```jsx
            <Route path="/customers" element={
              <Pelanggan 
                customers={customers} 
                packages={packages}
                role={session?.profile?.role}
                setShowAddCustomer={setShowAddCustomer} 
                onDeleteCustomer={handleDeleteCustomerDB}
                onUpdateCustomer={handleUpdateCustomerDB}
                onSyncEbilling={handleSyncCustomersFromEbilling}
              />
            } />
```

- [ ] **Step 6: Jalankan lint**

Run: `npm run lint`
Expected: tidak ada error baru.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App.jsx pakai profile Supabase Auth, route guard admin, bypass PIN untuk admin"
```

---

## Task 8: Update `src/components/Sidebar.jsx` — Menu per Role

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `session.profile.role`, `session.profile.full_name` (dari Task 7).

- [ ] **Step 1: Ganti deteksi role**

Modify `src/components/Sidebar.jsx:6-9`:

Old:
```js
  const user = session?.user;
  const isSuper = user?.email?.includes('superadmin') || user?.user_metadata?.role === 'superadmin';
  const roleName = isSuper ? 'Super Admin' : (user?.user_metadata?.name || 'Admin Kasir');
  const roleBadge = isSuper ? 'Super Administrator' : 'Admin POS';
```
New:
```js
  const isSuper = session?.profile?.role === 'superadmin';
  const roleName = isSuper ? 'Super Admin' : (session?.profile?.full_name || 'Admin Kasir');
  const roleBadge = isSuper ? 'Super Administrator' : 'Admin POS';
```

- [ ] **Step 2: Bungkus menu yang cuma boleh superadmin**

Modify `src/components/Sidebar.jsx:51-80` (seluruh blok menu):

Old:
```jsx
         <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-2">Layanan Utama</div>
            <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Home size={18} /> Beranda
            </NavLink>
            <NavLink to="/customers" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Users size={18} /> Pelanggan Retail
            </NavLink>
            <NavLink to="/pos" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Printer size={18} /> Kasir (58mm)
            </NavLink>
            <NavLink to="/aktivitas" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Activity size={18} /> Aktivitas Kasir
            </NavLink>
            <NavLink to="/settings" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <SettingsIcon size={18} /> Pengaturan
            </NavLink>

            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Layanan Korporat / B2B</div>
            <NavLink to="/instansi" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center justify-between px-3 py-3.5 rounded-2xl transition-all border-2 ${isActive ? 'border-gray-900 bg-gray-900 text-white font-bold shadow-lg shadow-gray-200' : 'border-transparent text-gray-800 hover:bg-gray-100 font-medium'}`}>
              <div className="flex items-center gap-3">
                 <Building2 size={18} className="text-blue-400"/> 
                 <div className="text-left">
                   <p className="text-sm">Invoice Instansi</p>
                   <p className="text-[9px] text-gray-400">Format Cetak A4</p>
                 </div>
              </div>
              <ChevronRight size={16} className="opacity-50" />
            </NavLink>
         </div>
```
New:
```jsx
         <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-2">Layanan Utama</div>
            {isSuper && (
              <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Home size={18} /> Beranda
              </NavLink>
            )}
            <NavLink to="/customers" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Users size={18} /> Pelanggan Retail
            </NavLink>
            <NavLink to="/pos" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <Printer size={18} /> Kasir (58mm)
            </NavLink>
            {isSuper && (
              <NavLink to="/aktivitas" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Activity size={18} /> Aktivitas Kasir
              </NavLink>
            )}
            <NavLink to="/settings" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
              <SettingsIcon size={18} /> Pengaturan
            </NavLink>

            {isSuper && (
              <>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Layanan Korporat / B2B</div>
                <NavLink to="/instansi" onClick={() => setIsOpen(false)} className={({ isActive }) => `w-full flex items-center justify-between px-3 py-3.5 rounded-2xl transition-all border-2 ${isActive ? 'border-gray-900 bg-gray-900 text-white font-bold shadow-lg shadow-gray-200' : 'border-transparent text-gray-800 hover:bg-gray-100 font-medium'}`}>
                  <div className="flex items-center gap-3">
                     <Building2 size={18} className="text-blue-400"/> 
                     <div className="text-left">
                       <p className="text-sm">Invoice Instansi</p>
                       <p className="text-[9px] text-gray-400">Format Cetak A4</p>
                     </div>
                  </div>
                  <ChevronRight size={16} className="opacity-50" />
                </NavLink>
              </>
            )}
         </div>
```

- [ ] **Step 3: Jalankan lint**

Run: `npm run lint`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: Sidebar sembunyikan menu Beranda/Aktivitas/Instansi untuk role admin"
```

---

## Task 9: Update `src/pages/Pelanggan.jsx` dan `src/pages/Transaksi.jsx` — Konsisten dengan RLS

**Files:**
- Modify: `src/pages/Pelanggan.jsx`
- Modify: `src/pages/Transaksi.jsx`

**Interfaces:**
- Consumes: prop `role` baru di `Pelanggan` (dikirim Task 7); `session.profile.full_name`/`session.profile.role` di `Transaksi` (dari Task 7).

**Kenapa task ini perlu:** RLS (Task 4) membuat `UPDATE`/`DELETE` di tabel `customers` cuma bisa dilakukan superadmin. `Pelanggan.jsx` sekarang punya tombol Edit (Pencil) dan Hapus (Trash2) yang selalu tampil untuk siapa saja — kalau dibiarkan, admin akan melihat tombol yang terlihat berfungsi tapi ditolak diam-diam oleh database. Tombol itu perlu disembunyikan untuk role admin supaya UI konsisten dengan aturan akses yang sebenarnya.

- [ ] **Step 1: Terima prop `role`**

Modify `src/pages/Pelanggan.jsx:11`:

Old:
```js
const Pelanggan = ({ customers = [], packages = [], setShowAddCustomer, onDeleteCustomer, onUpdateCustomer, onSyncEbilling }) => {
```
New:
```js
const Pelanggan = ({ customers = [], packages = [], role, setShowAddCustomer, onDeleteCustomer, onUpdateCustomer, onSyncEbilling }) => {
```

- [ ] **Step 2: Sembunyikan tombol Edit/Hapus di tampilan grid**

Modify `src/pages/Pelanggan.jsx:161-162`:

Old:
```jsx
                  <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={12}/></button>
                  <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
```
New:
```jsx
                  {role === 'superadmin' && (
                    <>
                      <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={12}/></button>
                      <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </>
                  )}
```

- [ ] **Step 3: Sembunyikan tombol Edit/Hapus di tampilan list**

Modify `src/pages/Pelanggan.jsx:286-287`:

Old:
```jsx
                      <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil size={14}/></button>
                      <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
```
New:
```jsx
                      {role === 'superadmin' && (
                        <>
                          <button onClick={() => setEditingCustomer(cust)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil size={14}/></button>
                          <button onClick={() => { if (window.confirm(`Hapus pelanggan "${cust.name}"?`)) onDeleteCustomer(cust.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                        </>
                      )}
```

- [ ] **Step 4: Perbaiki nama kasir default di Transaksi.jsx**

Modify `src/pages/Transaksi.jsx:49`:

Old:
```js
  const defaultCashierName = session?.user?.user_metadata?.name || session?.user?.name || (session?.user?.email?.includes('superadmin') ? 'Super Admin' : (session?.user?.email?.includes('admin') ? 'Admin Kasir' : (companyInfo?.adminName || 'Admin Kasir')));
```
New:
```js
  const defaultCashierName = session?.profile?.full_name || (session?.profile?.role === 'superadmin' ? 'Super Admin' : (companyInfo?.adminName || 'Admin Kasir'));
```

- [ ] **Step 5: Jalankan lint**

Run: `npm run lint`
Expected: tidak ada error baru.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Pelanggan.jsx src/pages/Transaksi.jsx
git commit -m "fix: sembunyikan aksi edit/hapus pelanggan untuk admin, samakan nama kasir dgn profile"
```

---

## Task 10: `AdminAccountsPanel.jsx` + Update `Settings.jsx` — Section per Role

**Files:**
- Create: `src/components/AdminAccountsPanel.jsx`
- Modify: `src/pages/Settings.jsx`

**Interfaces:**
- Consumes: tabel `admin_profiles` (Task 4) langsung lewat `supabase` client (dilindungi RLS — superadmin lihat semua baris, lainnya cuma baris sendiri); endpoint `/api/admin/create-user` (dibuat Task 11 — panel ini memanggilnya lewat `fetch`, jadi tetap bisa dikerjakan sekarang karena kontrak endpoint sudah didefinisikan Task 11).
- Produces: komponen `<AdminAccountsPanel session={session} />` dipasang di `Settings.jsx` khusus untuk superadmin.

- [ ] **Step 1: Buat komponen AdminAccountsPanel**

Create `src/components/AdminAccountsPanel.jsx`:
```jsx
import React, { useState, useEffect } from 'react';
import { UserPlus, RotateCcw, Smartphone, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AdminAccountsPanel = ({ session }) => {
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const loadAdmins = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('id, full_name, device_id, device_label, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (!error && data) setAdmins(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: formEmail, password: formPassword, fullName: formName }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal membuat akun admin.');
      }

      setShowCreateModal(false);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      await loadAdmins();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDevice = async (adminId) => {
    if (!window.confirm('Reset device akun ini? Admin akan bisa login dari device baru setelah ini.')) return;
    setResettingId(adminId);
    const { error } = await supabase
      .from('admin_profiles')
      .update({ device_id: null, device_label: null })
      .eq('id', adminId);

    if (error) {
      alert('Gagal reset device: ' + error.message);
    } else {
      await loadAdmins();
    }
    setResettingId(null);
  };

  return (
    <div>
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Manajemen Akun</h2>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="w-full py-3 px-4 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-100"
        >
          <UserPlus size={16} /> Buat Admin Baru
        </button>

        {isLoading ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Memuat daftar admin...</p>
        ) : admins.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Belum ada akun admin.</p>
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">{admin.full_name}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Smartphone size={12} />
                    {admin.device_label ? admin.device_label : 'Belum terkunci ke device manapun'}
                  </p>
                </div>
                {admin.device_id && (
                  <button
                    type="button"
                    onClick={() => handleResetDevice(admin.id)}
                    disabled={resettingId === admin.id}
                    className="text-[11px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {resettingId === admin.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Reset Device
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 relative">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black text-gray-900 mb-4">Buat Admin Baru</h3>

            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-3">{formError}</div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nama Kasir</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all disabled:opacity-70"
              >
                {isSubmitting ? 'Membuat...' : 'Buat Akun'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsPanel;
```

- [ ] **Step 2: Pasang di Settings.jsx + role-gate section yang sensitif**

Modify `src/pages/Settings.jsx:1-10` — tambah import:

Old:
```js
import { formatRupiah } from '../utils/format';
import { supabase } from '../lib/supabase';
import { testBillingSystemConnection, getEbillingLogs, clearEbillingLogs } from '../utils/billingApi';
```
New:
```js
import { formatRupiah } from '../utils/format';
import { supabase } from '../lib/supabase';
import { testBillingSystemConnection, getEbillingLogs, clearEbillingLogs } from '../utils/billingApi';
import AdminAccountsPanel from '../components/AdminAccountsPanel';
```

Modify `src/pages/Settings.jsx:28-29` — sumber `isSuper` dari profile, bukan email string:

Old:
```js
  const currentUser = session?.user;
  const isSuper = currentUser?.email?.includes('superadmin') || currentUser?.user_metadata?.role === 'superadmin';
```
New:
```js
  const currentUser = session?.user;
  const isSuper = session?.profile?.role === 'superadmin';
```

Modify `src/pages/Settings.jsx:194` (nama yang ditampilkan di kartu akun aktif) — pakai `full_name` dari profile:

Old:
```jsx
                    <span className="text-xs font-bold text-gray-800">{isSuper ? 'Super Administrator' : (currentUser?.user_metadata?.name || 'Admin Kasir')}</span>
```
New:
```jsx
                    <span className="text-xs font-bold text-gray-800">{isSuper ? 'Super Administrator' : (session?.profile?.full_name || 'Admin Kasir')}</span>
```

Modify `src/pages/Settings.jsx` — bungkus 3 section yang cuma boleh superadmin: **Identitas Toko** (baris 247-303), **Manajemen Paket** (baris 305-328), **Integrasi E-Billing** (baris 330-561). Tiga `<div>` ini adalah SIBLING (bukan nested), jadi kalau langsung dibungkus `{isSuper && ( ... )}` tanpa pembungkus tunggal akan error JSX ("adjacent JSX elements must be wrapped"). Karena itu pakai Fragment (`<>...</>`) di dalamnya. Ganti pembuka jadi `{isSuper && (\n        <>\n        <div>` dan tambahkan `</>\n        )}` penutup setelah `</div>` penutup section E-Billing (baris 561), lalu sisipkan `<AdminAccountsPanel />` setelah section E-Billing, sebelum Danger Zone:

Old (potongan awal, baris 246-249):
```jsx
        {/* Section: Identitas Toko */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Identitas Toko</h2>
```
New:
```jsx
        {/* Section: Identitas Toko, Manajemen Paket, E-Billing (khusus superadmin) */}
        {isSuper && (
        <>
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Identitas Toko</h2>
```

Old (potongan akhir section E-Billing, baris 558-563):
```jsx
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-4">
```
New:
```jsx
          </div>
        </div>
        </>
        )}

        {isSuper && <AdminAccountsPanel session={session} />}

        {/* Danger Zone */}
        <div className="pt-4">
```

Perhatikan: bagian tengah (section **Manajemen Paket**, baris 305-328 di versi lama) TIDAK diubah sama sekali isinya — cukup pastikan dia tetap berada di antara penutup `</div>` Identitas Toko dan pembuka `<div>` E-Billing, sekarang di dalam `<>...</>` yang sama.

- [ ] **Step 3: Jalankan lint**

Run: `npm run lint`
Expected: tidak ada error baru (perhatikan penutup JSX `)}` harus pas — 1 pembuka `{isSuper && (` di awal Identitas Toko harus ditutup persis sebelum Danger Zone, membungkus 3 section sekaligus).

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminAccountsPanel.jsx src/pages/Settings.jsx
git commit -m "feat: Settings.jsx sembunyikan section sensitif utk admin, tambah panel Manajemen Akun superadmin"
```

---

## Task 11: Vercel Function `create-user` + Set `SUPABASE_SERVICE_ROLE_KEY`

**Files:**
- Create: `api/_lib/verifySuperadmin.js`
- Create: `api/admin/create-user.js`

**Interfaces:**
- Consumes: header `Authorization: Bearer <access_token>` dan body `{ email, password, fullName }` dari `AdminAccountsPanel.jsx` (Task 10).
- Produces: response `{ success: true, userId }` (200) atau `{ error: string }` (400/401/403).

- [ ] **Step 1: Buat helper verifikasi superadmin**

Create `api/_lib/verifySuperadmin.js`:
```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

export function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function verifySuperadmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { error: { status: 401, message: 'Token otorisasi tidak ditemukan.' } };
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: callerData, error: callerError } = await anonClient.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return { error: { status: 401, message: 'Token tidak valid.' } };
  }

  const adminClient = getAdminClient();
  const { data: callerProfile, error: profileError } = await adminClient
    .from('admin_profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (profileError || callerProfile?.role !== 'superadmin') {
    return { error: { status: 403, message: 'Hanya superadmin yang boleh melakukan aksi ini.' } };
  }

  return { adminClient, callerId: callerData.user.id };
}
```

- [ ] **Step 2: Buat endpoint create-user**

Create `api/admin/create-user.js`:
```js
import { verifySuperadmin } from '../_lib/verifySuperadmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error, adminClient } = await verifySuperadmin(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const { email, password, fullName } = req.body || {};
  if (!email || !password || !fullName) {
    res.status(400).json({ error: 'Email, password, dan nama wajib diisi.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password minimal 6 karakter.' });
    return;
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    res.status(400).json({ error: createError.message });
    return;
  }

  const { error: insertProfileError } = await adminClient.from('admin_profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role: 'admin',
  });

  if (insertProfileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    res.status(400).json({ error: 'Gagal membuat profil admin: ' + insertProfileError.message });
    return;
  }

  res.status(200).json({ success: true, userId: created.user.id });
}
```

- [ ] **Step 3: Set service_role key di Vercel (dilakukan user sendiri — kunci ini punya akses penuh ke database, jangan pernah ditempel di chat/commit)**

User menjalankan sendiri di terminal (bukan Claude, supaya key tidak pernah muncul di riwayat percakapan):
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```
Saat diminta paste value, ambil dari Supabase Dashboard → **Project Settings** → **API** → bagian **service_role** (klik ikon mata untuk reveal, lalu copy).

- [ ] **Step 4: Commit kode (tanpa key apapun)**

```bash
git add api/_lib/verifySuperadmin.js api/admin/create-user.js
git commit -m "feat: tambah Vercel Function create-user untuk superadmin bikin akun admin"
```

---

## Task 12: Deploy + Verifikasi End-to-End Manual

**Files:** Tidak ada file baru — verifikasi penuh sistem yang sudah dibangun Task 1-11.

- [ ] **Step 1: Pastikan build lolos**

Run: `npm run build`
Expected: build sukses tanpa error.

- [ ] **Step 2: Push ke GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Deploy ke Vercel production**

Run: `vercel --prod --yes`
Expected: `readyState: READY`.

- [ ] **Step 4: Verifikasi login superadmin**

Buka situs production, login pakai `netsynergyinovate@gmail.com` (Task 5). Expected: masuk, Sidebar menampilkan semua menu (Beranda, Pelanggan, Kasir, Aktivitas, Pengaturan, Invoice Instansi), Settings menampilkan semua section termasuk "Manajemen Akun".

- [ ] **Step 5: Buat 1 akun admin lewat panel, verifikasi device-lock**

Di "Manajemen Akun" → "Buat Admin Baru", isi nama/email/password → submit. Expected: muncul di daftar dengan status "Belum terkunci ke device manapun". Buka browser/device lain (atau mode incognito terpisah), login pakai akun admin baru itu. Expected: berhasil masuk, dan di panel Manajemen Akun (login sebagai superadmin lagi, refresh) sekarang device_label admin itu terisi.

- [ ] **Step 6: Verifikasi device-lock menolak device kedua**

Dari device/browser ketiga (belum pernah dipakai akun admin ini), coba login pakai akun admin yang sama. Expected: ditolak dengan pesan "Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device."

- [ ] **Step 7: Verifikasi Reset Device**

Sebagai superadmin, klik "Reset Device" pada akun admin tsb. Expected: status kembali "Belum terkunci ke device manapun". Ulangi Step 6 dari device ketiga tadi — sekarang harus berhasil login.

- [ ] **Step 8: Verifikasi menu & akses terbatas admin**

Login sebagai admin (device manapun yang sudah terkunci). Expected: Sidebar cuma menampilkan Pelanggan, Kasir, Pengaturan. Settings cuma menampilkan "Koneksi Hardware" dan "Profil & Akun Pengguna" (tanpa Identitas Toko/Manajemen Paket/E-Billing/Manajemen Akun). Coba ketik URL `/instansi` atau `/aktivitas` langsung di address bar → harus ke-redirect otomatis ke `/pos`.

- [ ] **Step 9: Verifikasi RLS menolak bypass lewat DevTools**

Masih login sebagai admin, buka DevTools Console, jalankan:
```js
await window.supabase?.from('company_settings').update({ name: 'HACK' }).eq('id', 1)
```
(Kalau `supabase` client tidak ter-expose ke `window`, cukup verifikasi via tab Network bahwa request `PATCH .../company_settings` dari UI manapun mengembalikan array kosong/0 rows affected, bukan berhasil mengubah data — karena admin memang tidak seharusnya bisa mengubah tabel ini sama sekali.)
Expected: tidak ada baris yang berubah (RLS menolak, walau tidak melempar error keras — cukup pastikan data `company_settings` tidak berubah setelah reload halaman Settings sebagai superadmin).

- [ ] **Step 10: Verifikasi keep-alive tidak rusak**

Run: `npm run ping-db`
Expected: `✅ Supabase Ping Berhasil!` (memverifikasi fix Task 4 Step 4 tidak merusak workflow `.github/workflows/supabase-keepalive.yml` yang jalan tiap 24 jam).

- [ ] **Step 11: Verifikasi transaksi & tambah pelanggan oleh admin**

Sebagai admin: tambah 1 pelanggan baru (harus berhasil), buat 1 transaksi lewat Kasir (harus berhasil & struk tampil, nama kasir di struk = nama admin tsb bukan "Admin Kasir" generik). Coba cari tombol edit/hapus di daftar pelanggan → harus tidak ada (sesuai Task 9).
