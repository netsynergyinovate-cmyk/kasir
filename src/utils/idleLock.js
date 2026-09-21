// Kunci otomatis: aplikasi terkunci (minta PIN) kalau tidak disentuh selama IDLE_LIMIT_MS. Logika waktunya
// dipisah di sini supaya bisa diuji; pendengar aktivitas dan hitungan mundur ada di hooks/useIdleLock.js.
export const IDLE_LIMIT_MS = 15 * 60 * 1000;
export const ACTIVITY_KEY = 'last_activity_at';

export const remainingMs = (lastActivity, now, limit = IDLE_LIMIT_MS) => Math.max(0, lastActivity + limit - now);

export const isExpired = (lastActivity, now, limit = IDLE_LIMIT_MS) => remainingMs(lastActivity, now, limit) === 0;

// 872000 -> "14:32"
export function formatCountdown(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Tingkat urgensi tampilan hitungan mundur: normal, sebentar lagi terkunci (<= 60 dtk), hampir (<= 30 dtk).
export function countdownTone(ms) {
  if (ms <= 30 * 1000) return 'critical';
  if (ms <= 60 * 1000) return 'warning';
  return 'normal';
}

export function markActivity(now = Date.now()) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {
    // localStorage tidak tersedia; hitungan tetap jalan lewat state di hook.
  }
}

export function readLastActivity() {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}
