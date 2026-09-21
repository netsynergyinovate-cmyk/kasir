export const formatRupiah = (angka) => {
  if (angka === null || angka === undefined) return 'Rp 0';
  const s = Math.floor(angka).toString();
  let hasil = '';
  let count = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    hasil = s[i] + hasil;
    count++;
    if (count % 3 === 0 && i !== 0) hasil = '.' + hasil;
  }
  return 'Rp ' + hasil;
};

export const formatRupiahCompact = (angka) => {
  if (angka === null || angka === undefined) return '0';
  const value = Math.floor(angka);
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.', ',')}jt`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}rb`;
  }
  return `${value}`;
};

// Nomor invoice yang ditampilkan ke pelanggan (struk, riwayat): kode asli Runsnet kalau ketemu
// saat transaksi dibuat (lihat pickInvoiceNumber di utils/runsnetSync.js), kalau tidak ada
// (transaksi lama, atau tidak ketemu di Runsnet) pakai id transaksi seperti biasa.
export const getInvoiceNumber = (transaction) => transaction?.invoice_number || transaction?.invoiceNumber || transaction?.id || '';

export const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${dayName}, ${day} ${monthName} ${year} ${hours}:${minutes}:${seconds}`;
};
