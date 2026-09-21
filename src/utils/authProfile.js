import { getOrCreateDeviceId, getDeviceLabel } from './deviceId';

const PROFILE_COLUMNS = 'id, full_name, role, device_id, device_label';
const RECORDED_KEY = 'kasir_login_recorded';

// Lokasi perkiraan dari IP publik (best-effort, gagal diam-diam jika offline/diblokir).
export async function fetchApproxLocation() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ip: null, location: null };
    const data = await res.json();
    const location = [data.city, data.country_name].filter(Boolean).join(', ') || null;
    return { ip: data.ip || null, location };
  } catch {
    return { ip: null, location: null };
  }
}

export function clearLoginRecorded() {
  try {
    sessionStorage.removeItem(RECORDED_KEY);
  } catch {
    // sessionStorage tidak tersedia; abaikan.
  }
}

// Dipakai untuk semua metode login (password maupun Google): cek profil admin + device-lock,
// lalu catat login (waktu, device, IP, lokasi) via fungsi database record_login.
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

  const currentDeviceId = getOrCreateDeviceId();
  const currentDeviceLabel = getDeviceLabel();
  const isAdmin = profile.role === 'admin';

  if (isAdmin && profile.device_id && profile.device_id !== currentDeviceId) {
    return { error: 'Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device.' };
  }

  const needsBind = isAdmin && !profile.device_id;
  const alreadyRecorded = sessionStorage.getItem(RECORDED_KEY) === userId;

  if (needsBind || !alreadyRecorded) {
    const { ip, location } = await fetchApproxLocation();
    const { error: recordError } = await supabase.rpc('record_login', {
      p_device_id: currentDeviceId,
      p_device_label: currentDeviceLabel,
      p_location: location,
      p_ip: ip,
    });

    if (needsBind && recordError) {
      return { error: 'Gagal mengunci akun ke device ini: ' + recordError.message };
    }
    if (!recordError) sessionStorage.setItem(RECORDED_KEY, userId);

    if (needsBind) {
      return { profile: { ...profile, device_id: currentDeviceId, device_label: currentDeviceLabel } };
    }
  }

  return { profile };
}
