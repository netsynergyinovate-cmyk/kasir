# Design Spec: Upgrade Dashboard Superadmin & Penyempurnaan Sistem Komisi Kasir

**Tanggal:** 2026-09-24  
**Status:** Approved by User  
**Prinsip Desain:** `/ui-ux-pro-max`, `/design`, zero-regression pada fitur eksisting

---

## 1. Latar Belakang & Tujuan
1. **Peningkatan Tampilan & Fitur Dashboard Superadmin**: Mengembangkan antarmuka Dashboard Superadmin menjadi *Executive Command Center* yang profesional, berwibawa, dan intuitif tanpa menghapus satupun fitur atau komponen yang sudah ada.
2. **Atribusi Komisi yang Tepat & Adil**:
   - Super Admin **tidak mendapatkan komisi** (Rp 0).
   - Layanan CS (*Customer Service*) dikelola oleh Super Admin, sehingga transaksi CS berlabel non-komisi (Rp 0).
   - Hak komisi Rp 130.000 dari 13 transaksi non-CS yang berjalan diatribusikan kepada **Admin Wahyu**.
   - Setiap admin lain di masa depan berhak memperoleh komisi mandiri berdasarkan transaksi yang diprosesnya, dan Super Admin dapat mengelola/mentransfer komisi masing-masing admin secara terpisah.
3. **Pengelolaan Komisi Terpadu**:
   - Memastikan Dashboard Admin menampilkan informasi komisi (Total Hak, Sudah Cair, Sisa Pending, dan Riwayat Payout) secara realtime dan akurat.
   - Menyediakan tombol pintasan transfer komisi langsung dari Dashboard Superadmin untuk mempermudah pencairan tanpa harus berpindah ke tab Pengaturan.

---

## 2. Arsitektur Atribusi Komisi & Aturan Bisnis

### A. Aturan Peran & Kanal Pembayaran
| Aktor / Kanal | Status Komisi | Keterangan |
|---|---|---|
| **Super Admin** | Non-Komisi (Rp 0) | Ditandai badge `👑 Super Admin (Non-Komisi)` |
| **CS / Layanan CS** | Non-Komisi (Rp 0) | Transaksi dengan `payment_method === 'CS'` atau kasir berlabel CS tidak menghasilkan komisi |
| **Admin Wahyu** | Komisi Penuh (Rp 10.000/trx) | Transaksi kasir toko non-CS dialokasikan ke Admin Wahyu (Rp 130.000 saldo berjalan) |
| **Admin Lainnya** | Komisi Penuh (Rp 10.000/trx) | Dihitung otomatis per-transaksi yang diproses oleh akun kasir masing-masing (`isOwnTransaction`) |

### B. Rumus Perhitungan Finansial Toko
- **Omset Kotor Toko (`grossRevenue`)**: $\sum \text{price}$ dari seluruh transaksi LUNAS atau Instansi pada periode berjalan.
- **Kewajiban Komisi Kasir (`totalCommissionLiability`)**: $\sum (\text{transaksi non-CS admin} \times \text{adminFee})$.
- **Komisi Sudah Cair (`totalCommissionPaid`)**: $\sum \text{amount}$ riwayat payout berstatus `TERKIRIM`.
- **Sisa Komisi Pending Toko (`pendingCommissionBalance`)**: $\max(0, \text{Kewajiban Komisi} - \text{Komisi Sudah Cair})$.
- **Laba Bersih Toko (`netStoreProfit`)**: $\text{Omset Kotor Toko} - \text{Kewajiban Komisi Kasir}$.

---

## 3. Spesifikasi UI & Komponen Dashboard Superadmin

### A. Executive Financial & Commission Hub (Kartu Rekapitulasi Finansial)
Diletakkan di bawah Hero Sapaan:
- **Card 1: Omset Kotor Toko**: Menampilkan total uang masuk lunas bulan berjalan dengan badge tren persentase dibanding bulan lalu.
- **Card 2: Hak Komisi Kasir**: Total komisi yang menjadi hak para admin dengan rincian jumlah transaksi yang menghasilkan komisi.
- **Card 3: Status Pencairan**: Rincian nominal **Sudah Dicairkan** (hijau) dan **Sisa Pending Siap Ditransfer** (amber).
- **Card 4: Estimasi Laba Bersih**: Omset toko dikurangi seluruh komisi kasir.

### B. Executive Quick Action Bar (Pintasan Aksi Cepat)
Grid 6 pintasan dengan mikro-interaksi `quick-action-tile`:
1. ⚡ **Kasir Baru** (`/pos`): Pintasan cepat kasir.
2. 👥 **Pelanggan** (`/customers`): Pintasan data pelanggan & isolir.
3. 💸 **Kelola & Transfer Komisi**: Membuka modal kirim komisi langsung dari Dashboard.
4. 🗺️ **Rute & Tracking Live**: Navigasi ke peta pelacakan posisi admin & rute penagihan.
5. 📲 **Kirim WA Pengingat**: Memicu pengiriman reminder jatuh tempo massal via Watbiz.
6. ⚙️ **Pengaturan Toko**: Konfigurasi toko, paket wifi, dan fee kasir.

### C. Enhanced Cashier Performance & Commission Ranking
Daftar ranking kasir ditingkatkan:
- Setiap admin (Wahyu, dll) menampilkan:
  - Avatar lencana custom & inisial
  - Total omset yang dikumpulkan & jumlah transaksi
  - Rincian komisi: Komisi diperoleh, Sudah cair, dan Sisa pending
  - Tombol aksi **[Transfer Komisi]** di baris nama untuk membuka modal pencairan langsung ke admin tersebut.
- Akun Super Admin & CS diberi penanda visual abu-abu/ungu: *"👑 Super Admin (Non-Komisi)"* dan *"💬 Layanan CS (Non-Komisi)"*, dengan komisi Rp 0.

### D. Fitur & Komponen Eksisting yang Tetap Dipertahankan 100%
- Hero sapaan dengan status tanggal realtime.
- Pendapatan Harian (Hari Ini / Kemarin / Tanggal Khusus, rincian per metode pembayaran, dan toggle buku kas harian).
- Bar chart Omset 7 Hari Terakhir.
- KPI Bulanan (Lunas, Transaksi, Sudah Bayar, Pelanggan Belum Bayar).
- Aktivitas login terbaru admin.
- Komponen rute dan detail transaksi lengkap di bagian bawah (`Dashboard hideHeader canManageRoute`).

---

## 4. Rencana Pengujian & Validasi
1. **Unit Testing Atribusi Komisi**:
   - Memastikan transaksi dengan Super Admin / CS tidak menghitung komisi.
   - Memastikan transaksi kasir non-CS toko diatribusikan ke Admin Wahyu sehingga saldo Rp 130.000 akurat.
   - Memastikan admin kedua/ketiga dihitung terpisah sesuai transaksinya masing-masing.
2. **Integration Testing Dashboard Superadmin**:
   - Memverifikasi kartu ringkasan finansial menghitung omset kotor, total komisi kasir, dan sisa pending secara tepat.
   - Memverifikasi tombol [Transfer Komisi] di kartu performa kasir membuka modal transfer dengan target admin yang sesuai.
3. **Full Regression Test**: Seluruh 56 file test unit & integrasi harus tetap lolos 100%.
4. **Build Verification**: `npm run build` sukses tanpa warning atau error.
