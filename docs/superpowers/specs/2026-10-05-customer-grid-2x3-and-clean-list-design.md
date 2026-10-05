# Design Document: Customer Grid 2x3 Layout & Clean List View

**Date:** 2026-10-05  
**Status:** Approved by User (Option 1)  
**Target:** `src/pages/Pelanggan.jsx`  
**Tests:** `src/pages/__tests__/Pelanggan.test.jsx`

---

## 1. Problem Statement & Root Cause Analysis

### 1.1. Nama Pelanggan Tidak Nampak di Mode Kotak
1. **Fallback Data:** Saat objek pelanggan berasal dari sumber data berbeda (seperti transaksi atau API Runsnet/Supabase), properti nama mungkin tersimpan di `customer_name`, `customerName`, atau `nama`, sedangkan kode sebelumnya hanya membaca `cust.name`. Jika `cust.name` bernilai `undefined`, teks nama tidak ter-render sama sekali.
2. **Keterhimpitan Elemen (*Space Squeeze*):** Di baris header kartu kotak yang sempit (~170px), judul `h3` (`cust.name`) dipaksa berbagi ruang horizontal dengan 3 tombol aksi sekaligus (`Info`, `Pencil`, `Trash2`) yang memakan ~70px. Akibatnya judul terhimpit ke area sempit (<100px), dan kombinasi `line-clamp-2 break-words` di Tailwind v4 menyembunyikan atau memotong nama pelanggan.
3. **Multi-Kolom Tidak Sesuai Kebutuhan:** Di layar tertentu, layout menggunakan `lg:grid-cols-4 xl:grid-cols-5` sehingga kartu semakin sempit dan nama terpotong parah.

### 1.2. Mode List Tidak Rapi
1. Mode list menggunakan elemen `<table>` desktop 6 kolom (`Pelanggan & PPPoE`, `Status & Tagihan`, `Paket & Biaya`, `Kontak & IP`, `Lokasi & Alamat`, `Aksi`) di dalam container mobile 448px (`max-w-md`), memicu scroll horizontal yang canggung dan kolom yang terpotong.
2. Baris tabel tidak memiliki proporsi mobile-first yang bersih dan menyulitkan pembacaan status pelanggan.

---

## 2. Proposed Architecture & UI/UX Design

### 2.1. Mode Kotak (Grid 2x3 dengan Paginasi)
- **Struktur Grid:** Murni `grid grid-cols-2 gap-2.5 sm:gap-3` (2 kolom ke samping di semua ukuran layar container).
- **Kapasitas Tampilan:** 6 kartu per halaman (2 kolom ke samping, 3 baris ke bawah).
- **Desain Kartu Pelanggan:**
  - **Header:** Avatar inisial dengan background gradien warna (`AVATAR_COLORS`) + indikator status dot hijau/merah.
  - **Nama Pelanggan:** Ditampilkan jelas dan tebal (`text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words`) dengan fallback lengkap:
    `const displayName = cust.name || cust.customer_name || cust.customerName || cust.nama || 'Pelanggan';`
  - **Tombol Aksi Pojok Atas:** Hanya tombol `Info` atau menu opsi kecil yang tidak menghimpit judul nama. Tombol Edit/Hapus diletakkan rapi di bagian bawah atau di dalam modal detail.
  - **Metadata:** Paket internet, tagihan rupiah, status pembayaran bulan ini (*Lunas / Belum Bayar*), dan tanggal jatuh tempo.
  - **Aksi Cepat Kartu:** Tombol `Bayar` (POS), tombol `WhatsApp` (Template WA), dan tombol `Maps` jika memiliki koordinat.
- **Paginasi Cerdas:**
  - Mengatur `currentPage` (dimulai dari 1).
  - Mengambil data dengan irisan `filteredCustomers.slice((page - 1) * 6, page * 6)`.
  - Kontrol navigasi di bawah grid:
    - Tombol `‹ Sebelumnya` dan `Selanjutnya ›`.
    - Indikator `Halaman X dari Y` dan pill nomor halaman.
    - Otomatis reset ke halaman 1 saat pencarian atau filter status/paket berubah.

### 2.2. Mode List (Tabel Bersih & Pas di Layar)
- **Kompatibilitas Vitest:** Tetap menggunakan tag `<table>`, `<thead>`, `<tbody>`, dan `<tr onClick="...">` agar seluruh pengujian di `Pelanggan.test.jsx` lulus 100%.
- **Penataan Kolom (Pas 100% di Layar tanpa Horizontal Scroll Bar):**
  - **Kolom 1 (Pelanggan & Paket):** Avatar inisial, nama pelanggan tebal & jelas, paket internet & ID PPPoE.
  - **Kolom 2 (Status & Tagihan):** Nominal tagihan rupiah (`text-xs font-bold text-emerald-600`), badge status (*Lunas* hijau / *Belum Bayar* amber), tanggal jatuh tempo.
  - **Kolom 3 (Aksi):** Tombol Bayar cepat, tombol WA, dan tombol Info detail.
- **Estetika:** Padding baris proporsional (`py-2.5 px-2`), border bawah halus, hover highlight yang nyaman disentuh di HP.

---

## 3. Data Integrity & Verification Constraints
- 100% pengujian unit di `src/pages/__tests__/Pelanggan.test.jsx` (6 tests) harus lulus.
- Seluruh 56 file test Vitest (476+ tests) tetap lulus tanpa regresi.
- Build produksi `npm run build` sukses tanpa error.
- Serverless file count di `api/` tetap $\le 12$ files.
