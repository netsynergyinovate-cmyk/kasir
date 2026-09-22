const BASE_URL = 'https://app.watbiz.com';

// Kirim pesan WA lewat Watbiz (https://app.watbiz.com/api/wa/send). `media` opsional: link publik
// ke file (PDF invoice, dll). Dipanggil dari Vercel Function, bukan langsung dari browser, supaya
// tidak diblokir CORS oleh watbiz.com dan token tidak perlu dikirim berkali-kali dari client.
export async function sendWatbizMessage(token, { to, text, media }) {
  const response = await fetch(`${BASE_URL}/api/wa/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, text, media: media || '' }),
  });

  const raw = await response.text();
  let body = raw;
  try { body = JSON.parse(raw); } catch { /* Watbiz kadang balas teks polos, bukan JSON */ }

  return { ok: response.ok, status: response.status, body };
}
