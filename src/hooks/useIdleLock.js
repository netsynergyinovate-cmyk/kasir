import { useEffect, useRef, useState } from 'react';
import { IDLE_LIMIT_MS, remainingMs, isExpired, markActivity, readLastActivity } from '../utils/idleLock';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

// Mengunci aplikasi setelah limitMs tanpa aktivitas. Waktu aktivitas terakhir disimpan di localStorage,
// jadi menutup lalu membuka ulang aplikasi tidak mengulang hitungan: kalau sudah lewat batas, langsung
// terkunci. Mengembalikan sisa waktu (ms) untuk hitungan mundur di header.
export function useIdleLock({ enabled, onLock, limitMs = IDLE_LIMIT_MS }) {
  const [remaining, setRemaining] = useState(limitMs);
  const onLockRef = useRef(onLock);

  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    if (!enabled) return undefined;

    const stored = readLastActivity();
    if (stored && isExpired(stored, Date.now(), limitMs)) {
      onLockRef.current();
      return undefined;
    }
    if (!stored) markActivity();

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      markActivity(now);
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));

    const tick = () => {
      const left = remainingMs(readLastActivity() || Date.now(), Date.now(), limitMs);
      setRemaining(left);
      if (left <= 0) onLockRef.current();
    };
    const timerId = setInterval(tick, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      clearInterval(timerId);
    };
  }, [enabled, limitMs]);

  return remaining;
}
