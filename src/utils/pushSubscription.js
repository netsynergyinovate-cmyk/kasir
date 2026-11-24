import { supabase } from '../lib/supabase';
import { VAPID_PUBLIC_KEY } from './vapidKey';

const toBytes = (base64url) => Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));

// Daftarkan perangkat ini untuk push notification (pengingat Start On Work). ask: minta izin notifikasi
// (panggil dari ketukan tombol). Gagal diam-diam bila browser tidak mendukung atau izin ditolak.
// iPhone hanya mendukung push bila aplikasi sudah dipasang ke layar utama (PWA).
export async function subscribePush(userId, { ask = false } = {}) {
  if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
  try {
    if (ask && Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC_KEY) });
    const { error } = await supabase.from('push_subscriptions').upsert(
      { endpoint: subscription.endpoint, user_id: userId, subscription: subscription.toJSON(), updated_at: new Date().toISOString() },
      { onConflict: 'endpoint' },
    );
    if (error) console.warn('Gagal menyimpan langganan push:', error.message);
    return !error;
  } catch (error) {
    console.warn('Push notification tidak aktif:', error.message);
    return false;
  }
}
