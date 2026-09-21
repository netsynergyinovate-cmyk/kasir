import { getOrCreateDeviceId, getDeviceLabel } from './deviceId';

const PROFILE_COLUMNS = 'id, full_name, role, device_id, device_label';

// Dipakai untuk semua metode login (password maupun Google): cek profil admin + device-lock.
// Mengembalikan { profile } jika lolos, atau { error: string } jika harus ditolak.
export async function loadVerifiedProfile(supabase, authSession) {
  const userId = authSession.user.id;
  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: 'Akun ini belum terdaftar sebagai admin/superadmin di sistem.' };
  }

  if (profile.role === 'admin') {
    const currentDeviceId = getOrCreateDeviceId();
    const currentDeviceLabel = getDeviceLabel();

    if (!profile.device_id) {
      const { error: bindError } = await supabase
        .from('admin_profiles')
        .update({ device_id: currentDeviceId, device_label: currentDeviceLabel })
        .eq('id', userId);

      if (bindError) {
        return { error: 'Gagal mengunci akun ke device ini: ' + bindError.message };
      }
      return { profile: { ...profile, device_id: currentDeviceId, device_label: currentDeviceLabel } };
    }

    if (profile.device_id !== currentDeviceId) {
      return { error: 'Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device.' };
    }
  }

  return { profile };
}
