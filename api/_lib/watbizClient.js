const BASE_URL = 'https://app.watbiz.com';

// Dipanggil dari Vercel Function, bukan langsung dari browser, supaya tidak diblokir CORS oleh
// watbiz.com dan token tidak bolak-balik dari client. Auth: header `Api-key`, bukan Bearer token —
// dikonfirmasi lewat contoh curl asli dari dashboard app.watbiz.com (dokumentasi publik watbiz.com
// menyebut format yang beda dan TIDAK berfungsi untuk endpoint sungguhan ini).
async function watbizRequest(path, token, payload) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Api-key': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let body = raw;
  try { body = JSON.parse(raw); } catch { /* Watbiz kadang balas teks polos, bukan JSON */ }

  return { ok: response.ok && body?.status === 'success', status: response.status, body };
}

// Kirim pesan teks ke satu nomor. deviceId default 0 (device pertama di akun Watbiz).
export function sendWatbizMessage(token, { number, message, deviceId = 0 }) {
  return watbizRequest('/api/v2/send-message', token, { number, message, device_id: deviceId });
}

// Kirim file/media (dipakai untuk kirim PDF invoice). mediaUrl harus link publik yang bisa diakses
// Watbiz (mis. Supabase Storage), bukan data URL/base64.
export function sendWatbizMedia(token, { number, mediaType, mediaUrl, caption = '', filename = '' }) {
  return watbizRequest('/api/v2/send-media', token, { number, media_type: mediaType, media_url: mediaUrl, caption, filename });
}
