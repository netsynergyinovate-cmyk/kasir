// Ambang tanpa aktivitas sebelum push pengingat dikirim.
export const IDLE_MS = 60 * 60 * 1000;

// Sesi Start On Work terakhir tiap admin yang belum "selesai" dan tanpa aktivitas >= idleMs.
// Aktivitas = log kerja apa pun selain 'pengingat', atau detak lokasi aplikasi (admin_locations.updated_at,
// terkirim tiap 30 detik selama aplikasi terbuka). Satu pengingat per masa diam: dilewati bila sudah ada
// log 'pengingat' setelah aktivitas terakhir. logs harus urut created_at naik.
export function findIdleSessions({ logs, locations = [], now = Date.now(), idleMs = IDLE_MS }) {
  const sessions = new Map();
  for (const log of logs) {
    const at = Date.parse(log.created_at);
    const session = sessions.get(log.session_id)
      || { sessionId: log.session_id, adminId: log.admin_id, adminName: log.admin_name, lastActivity: 0, lastReminder: 0, finished: false };
    if (log.event === 'pengingat') session.lastReminder = Math.max(session.lastReminder, at);
    else session.lastActivity = Math.max(session.lastActivity, at);
    if (log.event === 'selesai') session.finished = true;
    if (log.admin_name) session.adminName = log.admin_name;
    sessions.set(log.session_id, session);
  }

  const latestByAdmin = new Map();
  sessions.forEach((session) => {
    const current = latestByAdmin.get(session.adminId);
    if (!current || session.lastActivity > current.lastActivity) latestByAdmin.set(session.adminId, session);
  });

  const seenAt = new Map(locations.map((row) => [row.admin_id, Date.parse(row.updated_at)]));
  return [...latestByAdmin.values()]
    .filter((session) => !session.finished)
    .map((session) => ({ ...session, lastActivity: Math.max(session.lastActivity, seenAt.get(session.adminId) || 0) }))
    .filter((session) => now - session.lastActivity >= idleMs && session.lastReminder < session.lastActivity);
}
