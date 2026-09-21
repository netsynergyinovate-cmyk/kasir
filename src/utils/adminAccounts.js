// Aturan siapa yang boleh dihapus lewat fitur "Hapus Admin" superadmin. Dipakai oleh Vercel Function
// (api/admin/delete-admin.js) sebagai penjaga sisi server, dipisah ke sini supaya bisa diuji.
export function canDeleteAdmin({ target, callerId }) {
  if (!target) return { ok: false, reason: 'Akun tidak ditemukan.' };
  if (target.id === callerId) return { ok: false, reason: 'Tidak bisa menghapus akun sendiri.' };
  if (target.role !== 'admin') return { ok: false, reason: 'Akun superadmin tidak bisa dihapus lewat fitur ini.' };
  return { ok: true };
}
