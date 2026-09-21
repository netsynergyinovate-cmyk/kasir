import { getOrCreateDeviceId, getDeviceLabel } from './deviceId';

const PROFILE_COLUMNS = 'id, full_name, role, device_id, device_label';
const RECORDED_KEY = 'kasir_login_recorded';

const GEO_CACHE_KEY = 'kasir_geo_cache';
// Layanan geolokasi IP yang mengizinkan pemanggilan dari browser (CORS); dicoba berurutan.
const GEO_PROVIDERS = ['https://get.geojs.io/v1/ip/geo.json', 'https://ipwho.is/'];

async function fetchFromProvider(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success === false) return null;
    const location = [data.city, data.country_name || data.country].filter(Boolean).join(', ') || null;
    const ip = data.ip || null;
    return ip || location ? { ip, location } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Lokasi perkiraan dari IP publik (best-effort). Hasil sukses di-cache per sesi tab agar tidak
// kena batas permintaan; gagal diam-diam jika offline/diblokir.
export async function fetchApproxLocation() {
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // cache tidak tersedia; lanjut ke jaringan.
  }

  for (const url of GEO_PROVIDERS) {
    const result = await fetchFromProvider(url);
    if (result) {
      try {
        sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(result));
      } catch {
        // abaikan
      }
      return result;
    }
  }
  return { ip: null, location: null };
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
    const who = authSession.user.email ? ` (${authSession.user.email})` : '';
    return { error: `Akun${who} belum terdaftar sebagai admin/superadmin di sistem. Minta superadmin mendaftarkannya.` };
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
