import { useState } from 'react';
import { formatDueReminderMessage } from '../utils/whatsappTemplates';

// Kirim pengingat jatuh tempo & peringatan isolir via WhatsApp — satu pelanggan (sendSingleReminder)
// atau semua sekaligus (sendBatchReminders(list)). Watbiz dipakai kalau aktif & token terisi, kalau
// tidak jatuh ke wa.me manual (openWhatsAppReminderDirect). Daftar pelanggannya sendiri ditentukan
// pemanggil — dipakai baik oleh Dashboard.jsx (jendela H-3 sampai jatuh tempo) maupun
// DashboardSuperadmin.jsx (semua pelanggan yang belum bayar bulan ini), supaya mekanisme kirimnya
// tidak dobel ditulis di dua tempat.
export function useWhatsAppReminders({ companyInfo, session }) {
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState(null);

  const openWhatsAppReminderDirect = (cust, daysLeft) => {
    const raw = (cust.phone || '').replace(/[^0-9]/g, '');
    const cleanNum = raw.startsWith('0') ? '62' + raw.slice(1) : raw;
    const msg = formatDueReminderMessage(cust, daysLeft, companyInfo);
    window.open(`https://wa.me/${cleanNum}?text=${encodeURIComponent(msg)}`, '_blank');
    setReminderFeedback({ type: 'info', message: `Membuka WhatsApp untuk mengirim pengingat ke ${cust.name}.` });
  };

  const sendSingleReminder = async (cust) => {
    if (!cust.phone) {
      alert(`Pelanggan ${cust.name} tidak memiliki nomor WhatsApp.`);
      return;
    }
    const daysLeft = Math.max(0, -(cust.dueDiff ?? 0));
    setSendingReminderId(cust.id);
    setReminderFeedback(null);
    try {
      if (companyInfo.watbizEnabled && companyInfo.watbizToken) {
        const res = await fetch('/api/watbiz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            action: 'send-reminder',
            customer: cust,
            daysLeft,
            companyInfo,
            senderName: session?.profile?.full_name || 'Admin Kasir',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setReminderFeedback({ type: 'success', message: `Pengingat & peringatan isolir terkirim ke ${cust.name} (${cust.phone}).` });
        } else {
          openWhatsAppReminderDirect(cust, daysLeft);
        }
      } else {
        openWhatsAppReminderDirect(cust, daysLeft);
      }
    } catch (err) {
      console.warn('Gagal panggil Watbiz API:', err.message);
      openWhatsAppReminderDirect(cust, daysLeft);
    } finally {
      setSendingReminderId(null);
    }
  };

  const sendBatchReminders = async (list) => {
    const targets = list.filter((c) => c.phone);
    if (targets.length === 0) {
      alert('Tidak ada pelanggan di daftar ini yang memiliki nomor WhatsApp.');
      return;
    }

    if (!window.confirm(`Kirim pesan pengingat jatuh tempo & peringatan isolir ke ${targets.length} pelanggan secara masal via Watbiz?`)) {
      return;
    }

    setIsSendingBatch(true);
    setReminderFeedback(null);
    try {
      const res = await fetch('/api/watbiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'send-reminders',
          customers: targets,
          companyInfo,
          senderName: session?.profile?.full_name || 'Admin Kasir',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setReminderFeedback({
          type: 'success',
          message: `Selesai: ${data.success} pengingat isolir berhasil dikirim${data.failed > 0 ? `, ${data.failed} gagal` : ''} dari total ${data.total} pelanggan.`,
        });
      } else {
        setReminderFeedback({ type: 'error', message: data.error || 'Gagal mengirim pengingat masal via Watbiz.' });
      }
    } catch (err) {
      setReminderFeedback({ type: 'error', message: 'Koneksi error: ' + err.message });
    } finally {
      setIsSendingBatch(false);
    }
  };

  return {
    sendingReminderId,
    isSendingBatch,
    reminderFeedback,
    setReminderFeedback,
    sendSingleReminder,
    sendBatchReminders,
    openWhatsAppReminderDirect,
  };
}
