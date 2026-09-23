import { formatRupiah } from './format';

/**
 * Normalisasi nomor HP ke format WhatsApp internasional Indonesia (628xxx).
 * Mengubah format seperti '0812-3456-7890', '+62 812', atau '812' menjadi '6281234567890'.
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Format tanggal & jam ke format Indonesia (DD MMMM YYYY, HH:mm WIB).
 */
export function formatDateTimeIndo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} pukul ${timePart} WIB`;
}

/**
 * Template Bukti Pembayaran Resmi (Invoice WhatsApp)
 * Berbeda dari struk kasir thermal; berformat rapi, formal, dan mudah dibaca di WhatsApp.
 */
export function formatPaymentInvoiceMessage(trx = {}, customer = {}, companyInfo = {}) {
  const compName = companyInfo.name || 'PT Net Synergy Inovate';
  const compAddress = companyInfo.address || '';
  const compPhone = companyInfo.phone || '';

  const custName = trx.customerName || trx.customer_name || customer.name || 'Pelanggan';
  const pppoe = trx.pppoeId || trx.pppoe_id || customer.pppoe_id || customer.pppoeId || '-';
  const invNumber = trx.invoiceNumber || trx.invoice_number || trx.id || '-';
  const pkgName = trx.packageName || trx.package_name || customer.package || 'Internet';
  const nominal = formatRupiah(trx.amountPaid || trx.amount_paid || trx.price || 0);
  const dateFormatted = formatDateTimeIndo(trx.date || new Date().toISOString());
  const method = trx.paymentMethod || trx.payment_method || 'Cash / Tunai';
  const cashier = trx.cashierName || trx.cashier_name || companyInfo.adminName || 'Admin Kasir';

  return `🧾 *BUKTI PEMBAYARAN RESMI*
*${compName.toUpperCase()}*
${compAddress ? `_${compAddress}_\n` : ''}-----------------------------------

Yth. Bapak/Ibu *${custName}*,
Terima kasih! Pembayaran tagihan internet Anda telah berhasil kami terima dan dinyatakan *LUNAS*.

📋 *RINCIAN PEMBAYARAN:*
• *No. Invoice:* \`${invNumber}\`
• *Waktu Bayar:* ${dateFormatted}
• *ID Pelanggan / PPPoE:* \`${pppoe}\`
• *Paket Layanan:* *${pkgName}*
• *Total Dibayar:* *${nominal}*
• *Metode Bayar:* ${method}
• *Status Transaksi:* ✅ *LUNAS (TERVERIFIKASI)*
• *Kasir / Penerima:* ${cashier}

-----------------------------------
💡 *Status Layanan:*
Koneksi internet Anda *AKTIF*. Jika sempat mengalami kendala sebelumnya, mohon restart router/modem Anda selama 1 menit.

Simpan pesan WhatsApp ini sebagai bukti pembayaran resmi yang sah.
${compPhone ? `\n📞 *Layanan Bantuan & CS:* ${compPhone}` : ''}
Salam hangat,
*${compName}*`;
}

/**
 * Template Pengingat Jatuh Tempo (H-2 / H-1 / Hari H) & Peringatan Isolir Otomatis.
 */
export function formatDueReminderMessage(cust = {}, daysLeft = 1, companyInfo = {}) {
  const compName = companyInfo.name || 'PT Net Synergy Inovate';
  const compPhone = companyInfo.phone || '';
  const custName = cust.name || 'Pelanggan';
  const pppoe = cust.pppoe_id || cust.pppoeId || '-';
  const pkg = cust.package || 'Internet';
  const price = cust.price ? formatRupiah(cust.price) : 'Rp -';
  const dueDate = cust.due_date || cust.dueDate || '-';

  let timeDesc = 'hari ini';
  if (daysLeft === 2) timeDesc = '2 hari lagi';
  else if (daysLeft === 1) timeDesc = 'besok (1 hari lagi)';
  else if (daysLeft <= 0) timeDesc = 'HARI INI';

  return `⚠️ *PEMBERITAHUAN JATUH TEMPO & PERINGATAN ISOLIR*
*${compName.toUpperCase()}*
-----------------------------------

Yth. Bapak/Ibu *${custName}*,
ID Pelanggan / PPPoE: \`${pppoe}\`

Kami menginformasikan bahwa tagihan internet Anda untuk bulan berjalan akan jatuh tempo *${timeDesc}* (Batas: *Tgl ${dueDate}*):

📌 *Rincian Tagihan:*
• *Paket Layanan:* *${pkg}*
• *Total Tagihan:* *${price}*
• *Batas Pembayaran:* *Tgl ${dueDate}*

🚨 *PERINGATAN PENTING:*
Mohon segera melakukan pembayaran sebelum batas jatuh tempo. Apabila pembayaran belum kami terima melewati batas waktu tersebut, sistem server akan melakukan *PEMUTUSAN KONEKSI / ISOLIR OTOMATIS*.

💳 *Cara Pembayaran:*
1. Bayar langsung melalui kasir/kolektor resmi kami.
2. Transfer ke rekening resmi dan kirimkan bukti transfer ke WhatsApp ini (akan otomatis diproses oleh sistem).

_Abaikan pesan ini jika Anda telah menyelesaikan pembayaran. Terima kasih atas kerja sama dan pengertiannya._ 🙏
${compPhone ? `\n📞 Info & Bantuan: ${compPhone}` : ''}
Salam hormat,
*${compName}*`;
}

/**
 * Template Konfirmasi Otomatis saat Webhook Memverifikasi Bukti Transfer
 */
export function formatAutoPaymentConfirmedMessage(cust = {}, trx = {}, companyInfo = {}) {
  const compName = companyInfo.name || 'PT Net Synergy Inovate';
  const custName = cust.name || 'Pelanggan';
  const pkg = trx.packageName || trx.package_name || cust.package || 'Internet';
  const nominal = formatRupiah(trx.amountPaid || trx.price || cust.price || 0);
  const invNumber = trx.invoiceNumber || trx.invoice_number || trx.id || '-';
  const dateFormatted = formatDateTimeIndo(trx.date || new Date().toISOString());

  return `✅ *PEMBAYARAN OTOMATIS DIVERIFIKASI*
*${compName.toUpperCase()}*
-----------------------------------

Halo Bapak/Ibu *${custName}*,
Terima kasih! Bukti transfer pembayaran internet Anda telah kami terima dan *otomatis diverifikasi LUNAS* oleh sistem:

• *No. Invoice:* \`${invNumber}\`
• *Waktu Verifikasi:* ${dateFormatted}
• *Paket Layanan:* *${pkg}*
• *Nominal:* *${nominal}*
• *Metode:* Transfer WhatsApp (Verifikasi Otomatis)
• *Status Layanan:* ✅ *AKTIF NORMAL*

Layanan internet Anda tetap aktif dan tidak akan mengalami isolir. Terima kasih telah mempercayai layanan *${compName}*! 🙏`;
}

/**
 * Template jika pelanggan sudah lunas bulan ini
 */
export function formatAlreadyPaidMessage(cust = {}, companyInfo = {}) {
  const compName = companyInfo.name || 'PT Net Synergy Inovate';
  const custName = cust.name || 'Pelanggan';
  const lastDate = cust.last_payment_date ? formatDateTimeIndo(cust.last_payment_date) : 'bulan ini';

  return `ℹ️ *INFORMASI STATUS PEMBAYARAN*
*${compName.toUpperCase()}*
-----------------------------------

Halo Bapak/Ibu *${custName}*,
Tagihan internet Anda untuk bulan berjalan sudah tercatat *LUNAS* sebelumnya (${lastDate}).

Status layanan internet Anda saat ini adalah *AKTIF*. Tidak ada tagihan tertunggak untuk periode ini. Terima kasih! 🙏`;
}

/**
 * Template jika nomor WhatsApp pengirim belum terdaftar di pelanggan
 */
export function formatUnregisteredNumberMessage(phone = '', companyInfo = {}) {
  const compName = companyInfo.name || 'PT Net Synergy Inovate';
  const compPhone = companyInfo.phone || '';

  return `Halo, nomor WhatsApp Anda (*${phone}*) belum terdaftar dalam sistem data pelanggan *${compName}*.

Jika Anda adalah pelanggan kami dan baru saja melakukan pembayaran, mohon hubungi admin kami${compPhone ? ` di ${compPhone}` : ''} dengan menyertakan Nama Lengkap dan ID PPPoE/Pelanggan Anda agar dapat kami catat. Terima kasih! 🙏`;
}
