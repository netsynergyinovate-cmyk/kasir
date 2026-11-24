// Dijalankan GitHub Actions (.github/workflows/work-reminder.yml) tiap 15 menit:
// cari admin yang belum menyelesaikan Start On Work dan 1 jam tanpa aktivitas, kirim push ke HP admin itu
// dan ke semua superadmin, lalu catat log 'pengingat' (terlihat superadmin di Log Kerja).
// Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY.
import webpush from 'web-push';
import { findIdleSessions } from './idle.js';
import { VAPID_PUBLIC_KEY } from '../../src/utils/vapidKey.js';

const { VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, VAPID_PRIVATE_KEY: vapidPrivate } = process.env;
if (!url || !key || !vapidPrivate) {
  console.error('VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY dan VAPID_PRIVATE_KEY wajib di-set.');
  process.exit(1);
}

const rest = async (path, init = {}) => {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

webpush.setVapidDetails('https://kasirnetsi.vercel.app', VAPID_PUBLIC_KEY, vapidPrivate);

const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const [logs, locations, subscriptions, superadmins] = await Promise.all([
  rest(`work_logs?select=session_id,admin_id,admin_name,event,created_at&created_at=gte.${since}&order=created_at.asc`),
  rest('admin_locations?select=admin_id,updated_at'),
  rest('push_subscriptions?select=endpoint,user_id,subscription'),
  rest('admin_profiles?select=id&role=eq.superadmin'),
]);

const idle = findIdleSessions({ logs, locations });
console.log(`${idle.length} sesi Start On Work tanpa aktivitas >= 1 jam.`);
const superIds = new Set(superadmins.map((row) => row.id));

const send = async (row, payload) => {
  try {
    await webpush.sendNotification(row.subscription, JSON.stringify(payload));
    return 1;
  } catch (error) {
    // Langganan kedaluwarsa / dicabut: hapus supaya tidak dicoba lagi.
    if (error.statusCode === 404 || error.statusCode === 410) {
      await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(row.endpoint)}`, { method: 'DELETE' });
    } else {
      console.warn('Push gagal:', error.statusCode, error.body || error.message);
    }
    return 0;
  }
};

for (const session of idle) {
  const name = session.adminName || 'Admin';
  let delivered = 0;
  for (const row of subscriptions.filter((sub) => sub.user_id === session.adminId)) {
    delivered += await send(row, {
      title: 'Start On Work belum selesai',
      body: 'Tidak ada aktivitas selama 1 jam. Buka aplikasi untuk melanjutkan atau tekan Selesai Kerja.',
      url: '/start-on-work',
      tag: `sow-${session.sessionId}`,
    });
  }
  for (const row of subscriptions.filter((sub) => superIds.has(sub.user_id))) {
    delivered += await send(row, {
      title: `${name} belum menyelesaikan kerja`,
      body: `Start On Work ${name} tidak ada aktivitas selama 1 jam.`,
      url: '/start-on-work',
      tag: `sow-super-${session.sessionId}`,
    });
  }
  // Dicatat walau push tidak terkirim: superadmin tetap melihatnya di Log Kerja, dan tidak dikirim ulang.
  await rest('work_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      session_id: session.sessionId,
      admin_id: session.adminId,
      admin_name: session.adminName,
      event: 'pengingat',
      note: `Tidak ada aktivitas 1 jam · push terkirim ke ${delivered} perangkat`,
    }),
  });
  console.log(`${name}: pengingat dicatat, ${delivered} push terkirim.`);
}
