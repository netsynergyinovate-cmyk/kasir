// Buka kunci aplikasi pakai kunci layar perangkat itu sendiri (sidik jari, Face ID, PIN/pola HP,
// Windows Hello / passkey) lewat WebAuthn — tidak ada PIN aplikasi terpisah.
// shortcut: verifikasi hanya di perangkat (tanda tangan tidak dicek server), setara PIN lama yang juga dicek
// di klien; pindah ke verifikasi server kalau kunci ini harus tahan manipulasi lewat devtools.
const keyFor = (userId) => `device_auth_cred_${userId}`;
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

export async function isDeviceAuthAvailable() {
  try {
    return Boolean(await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.());
  } catch {
    return false;
  }
}

export function forgetDeviceAuth(userId) {
  try { localStorage.removeItem(keyFor(userId)); } catch { /* storage tidak tersedia */ }
}

// Lempar error kalau dibatalkan/gagal; selesai normal = pemilik perangkat terverifikasi.
export async function verifyDevice(userId, userName) {
  let saved = null;
  try { saved = localStorage.getItem(keyFor(userId)); } catch { /* storage tidak tersedia */ }

  if (saved) {
    await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        allowCredentials: [{ type: 'public-key', id: fromB64(saved), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return;
  }

  // Belum terdaftar di perangkat ini: membuat kredensial juga meminta kunci layar, jadi sekaligus verifikasi.
  const name = userName || userId;
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'KAsir' },
      user: { id: new TextEncoder().encode(userId), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  try { localStorage.setItem(keyFor(userId), toB64(cred.rawId)); } catch { /* tetap lolos untuk sesi ini */ }
}
