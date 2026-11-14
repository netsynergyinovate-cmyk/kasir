import { getOrCreateDeviceId, getDeviceLabel } from './deviceId';

const PROFILE_COLUMNS = 'id, full_name, role, device_id, device_label, allowed_paths';
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

// Mengubah nama tampilan akun yang SEDANG LOGIN (bukan akun lain) lewat fungsi database
// update_my_name — supaya tiap admin/superadmin punya nama sendiri, bukan satu nama bersama.
export async function updateMyName(supabase, fullName) {
  const { error } = await supabase.rpc('update_my_name', { p_full_name: fullName });
  return { error: error ? error.message : null };
}

// PIN buka aplikasi milik satu akun (fungsi database set_admin_pin): akun sendiri, atau akun lain kalau
// pemanggilnya superadmin. pin kosong = hapus (kembali ke PIN bersama company_settings.app_pin).
export async function setAdminPin(supabase, adminId, pin) {
  const { error } = await supabase.rpc('set_admin_pin', { p_admin_id: adminId, p_pin: pin || null });
  return { error: error ? error.message : null };
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
  const fetchProfile = () => supabase
    .from('admin_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  let { data: profile, error: profileError } = await fetchProfile();

  // Belum punya profil: mungkin baru diundang superadmin. claim_invite mengubah undangan
  // (berdasarkan email Google yang terverifikasi) menjadi profil admin.
  if (!profileError && !profile) {
    const { data: claimed, error: claimError } = await supabase.rpc('claim_invite');
    if (!claimError && claimed) {
      ({ data: profile, error: profileError } = await fetchProfile());
    }
  }

  if (profileError || !profile) {
    const who = authSession.user.email ? ` (${authSession.user.email})` : '';
    return { error: `Akun${who} belum terdaftar sebagai admin/superadmin di sistem. Minta superadmin mendaftarkannya.` };
  }

  const currentDeviceId = getOrCreateDeviceId();
  const currentDeviceLabel = getDeviceLabel();
  const isAdmin = profile.role === 'admin';

  // Device HANYA ditolak kalau superadmin sudah mengunci akun ini secara manual (panel Akun Admin).
  // Tidak ada auto-lock lagi di login pertama — device manapun boleh masuk sampai superadmin mengunci.
  if (isAdmin && profile.device_id && profile.device_id !== currentDeviceId) {
    return { error: 'Akun ini terkunci ke device lain. Hubungi superadmin untuk reset device.' };
  }

  const alreadyRecorded = sessionStorage.getItem(RECORDED_KEY) === userId;
  if (!alreadyRecorded) {
    const { ip, location } = await fetchApproxLocation();
    const { error: recordError } = await supabase.rpc('record_login', {
      p_device_id: currentDeviceId,
      p_device_label: currentDeviceLabel,
      p_location: location,
      p_ip: ip,
    });
    if (!recordError) sessionStorage.setItem(RECORDED_KEY, userId);
  }

  // Dibaca terpisah: kolom app_pin baru ada setelah supabase_admin_pin.sql dijalankan, dan login tidak boleh
  // gagal hanya karena kolom itu belum ada (error diabaikan -> pakai PIN bersama).
  const { data: pinRow } = await supabase.from('admin_profiles').select('app_pin').eq('id', userId).maybeSingle();
  return { profile: pinRow?.app_pin ? { ...profile, app_pin: pinRow.app_pin } : profile };
}
