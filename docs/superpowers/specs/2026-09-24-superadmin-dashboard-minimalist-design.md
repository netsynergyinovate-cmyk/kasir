# Design Document: Minimalist Executive Hub & Folder Navigation for Dashboard Superadmin

**Date:** 2026-09-24  
**Status:** Approved by User (Option 1)  
**Target:** `src/pages/DashboardSuperadmin.jsx`

---

## 1. Problem Statement & User Critique
Berdasarkan tinjauan langsung pada tampilan dashboard:
1. **Data Ganda (Redundansi):** Di dalam banner Hero terdapat strip metrik ("Bulan Berjalan 6,5jt", "Laba Bersih Est. 6,3jt"), yang langsung diduplikasi kembali di bawahnya pada "Ringkasan Finansial Eksekutif" ("Omset Kotor Toko Rp 6.450.000", "Laba Bersih Toko Rp 6.260.000"). Ini membingungkan dan menghabiskan ruang visual.
2. **Elemen Terlalu Besar (Visual Bloat):** Banner hero gelap terlalu masif, ukuran font angka terlalu raksasa (`text-2xl`/`text-3xl`), padding dan card terlalu tebal, sehingga pengguna mobile harus scroll jauh dan informasi penting terpotong.
3. **Aksi Cepat Tidak Rapi:** Deretan tombol aksi berjejer horizontal panjang dengan teks terpotong (misal "Pengaturan Toko & Paket"), tanpa pengelompokan yang jelas.

---

## 2. Proposed Architecture & Design Specification

### 2.1. Slim Minimalist Header (Eliminasi Data Ganda)
- **Desain:** Header ramping berlatar putih/slate-50 dengan aksen indigo halus (bukan dark card raksasa).
- **Konten:** 
  - Ucapan sapaan: `"Halo, " + displayName` dengan subtitle tanggal dan role badge `"Super Administrator"`.
  - Status koneksi real-time: titik hijau `"Sistem Aktif & Terpantau"`.
  - **Hapus total strip metrik angka di dalam hero** untuk menghilangkan duplikasi data.

### 2.2. Compact Financial Hub (Ringkas, Proporsional & Presisi)
- **Desain:** Grid 2 kolom di mobile, 4 kolom di desktop dengan padding ringkas (`p-3` s.d `p-3.5`), ukuran angka proporsional (`text-lg font-bold sm:text-xl font-extrabold`).
- **Komponen Metrik Utama (Tanpa Redundansi):**
  1. **Omset Kotor Toko**: Nominal total omset bulan berjalan + badge pertumbuhan (+21%) + jumlah transaksi lunas.
  2. **Hak Komisi Kasir**: Total liabilitas komisi + info rate komisi per transaksi (`Rp 10.000/trx`).
  3. **Komisi Dicairkan**: Nominal komisi yang sudah dibayar + status pending/lunas badge.
  4. **Laba Bersih Toko**: Nominal laba bersih setelah dikurangi komisi kasir + persentase margin toko.
- **Karakter Visual:** Clean border slate-200/60, soft shadow, label uppercase kecil (`text-[10px] font-bold text-slate-500`).

### 2.3. Folder Navigasi Terpadu (Folder-Style Quick Action Dock)
- **Desain:** Mengelompokkan tombol aksi ke dalam wadah bergaya folder navigasi yang rapi dan terstruktur:
  - Header folder: Tab / Segmen Folder Kategori:
    - 📁 **Semua Menu**
    - 📁 **Operasional & POS** (`Kasir Baru`, `Pelanggan`)
    - 📁 **Finansial & Tagihan** (`Kelola Komisi`, `WA Tagihan`)
    - 📁 **Sistem & Rute** (`Rute & Live`, `Pengaturan`)
  - Kartu tombol aksi compact: Icon rapi (ukuran 32x32px), label judul tajam tidak terpotong, badge status ringkas.
  - Interaksi cepat: `[Kelola Komisi]` langsung membuka modal komisi admin.
  - Mempertahankan seluruh teks yang dituntut pengujian: `Kasir Baru`, `Pelanggan`, `Kelola Komisi`, `Rute & Live`, `WA Tagihan`, `Pengaturan`.

### 2.4. Rescaling & Refinement Modul Bawah
- **Pendapatan Harian:**
  - Segmented pill switcher (`Hari Ini`, `Kemarin`, `Pilih Tanggal`) dibuat compact.
  - Hero card pendapatan hari ini diskalakan menjadi elegan dan tidak memakan tinggi layar.
  - Accordion Buku Kas Harian dibuat dengan list row padat informasi, avatar inisial rapi, nominal jelas.
- **Omset 7 Hari & KPI Bulanan:**
  - Bar chart dibuat ramping dengan tinggi proporsional (`h-24` hingga `h-28`), tidak oversized.
  - KPI bulanan dibuat berupa mini progress cards horizontal yang rapi.
- **Performa Kasir & Security Audit:**
  - Tabel leaderboard kasir dibuat clean dengan nomor urutan podium (#1, #2, #3), status komisi pill, dan tombol `[Transfer Komisi]` yang proporsional.
  - Security audit stream dibuat menjadi baris audit compact.

---

## 3. Data Integrity & Business Rules
1. **Super Admin**: Komisi tetap Rp 0.
2. **Admin CS**: Komisi tetap Rp 0.
3. **Admin Wahyu**: Komisi Rp 130.000 (13 transaksi toko non-CS).
4. **Multi-admin**: Mendukung pengaturan independen per admin kasir.
5. **Serverless Function Limit**: Folder `api/` tetap $\le 12$ file.

---

## 4. Verification & Testing Checklist
- [ ] `src/pages/__tests__/DashboardSuperadmin.test.jsx` lulus 9/9 tes.
- [ ] Seluruh string kunci ada di DOM:
  - `Halo, Super Administrator`
  - `Performa Kasir`, `Aktivitas Login Terbaru`, `Detail Lengkap`
  - `Pendapatan Harian`, `Hari Ini`, `Kemarin`, `Pilih Tanggal`
  - `Buku kas harian` (tanpa `Pembukuan 7 Hari`)
  - `Siti` muncul sebelum `Budi`
  - `Omset Kotor Toko`, `Hak Komisi Kasir`, `Laba Bersih Toko`
  - `Kasir Baru`, `Pelanggan`, `Kelola Komisi`, `Rute &amp; Live`, `WA Tagihan`, `Pengaturan`
  - `Transfer Komisi`
- [ ] Full regression vitest suite lulus 100% (56 test files, 476 tests).
- [ ] `npm run build` sukses tanpa error.
