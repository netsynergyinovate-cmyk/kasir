import { verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { canDeleteAdmin } from '../../src/utils/adminAccounts.js';

// Menghapus akun admin (khusus superadmin). Menghapus user di Supabase Auth memakai service_role;
// baris admin_profiles dan admin_locations ikut terhapus otomatis (on delete cascade). Riwayat
// kunjungan (customer_visits) tetap ada karena visited_by bukan foreign key.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { error, adminClient, callerId } = await verifySuperadmin(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const { adminId } = req.body || {};
  if (!adminId) {
    res.status(400).json({ error: 'adminId wajib diisi.' });
    return;
  }

  const { data: target } = await adminClient
    .from('admin_profiles')
    .select('id, role, email')
    .eq('id', adminId)
    .maybeSingle();

  const check = canDeleteAdmin({ target, callerId });
  if (!check.ok) {
    res.status(400).json({ error: check.reason });
    return;
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(adminId);
  if (deleteError) {
    res.status(500).json({ error: 'Gagal menghapus akun: ' + deleteError.message });
    return;
  }

  // Bersihkan undangan lama untuk email yang sama supaya tidak otomatis jadi admin lagi kalau login ulang.
  if (target.email) {
    await adminClient.from('admin_invites').delete().eq('email', target.email);
  }

  res.status(200).json({ deleted: true });
}
