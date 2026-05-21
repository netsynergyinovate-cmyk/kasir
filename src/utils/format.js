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
