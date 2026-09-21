// Supabase mengirim kegagalan login OAuth lewat query string / hash URL. Baca supaya bisa ditampilkan.
export function readAuthRedirectError(href) {
  const url = new URL(href);
  const params = new URLSearchParams(url.search);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));

  const get = (key) => params.get(key) || hashParams.get(key);
  const error = get('error');
  if (!error) return null;

  const description = get('error_description');
  const code = get('error_code');
  if (code === 'signup_disabled') {
    return 'Email Google ini belum terdaftar di sistem. Minta superadmin mendaftarkannya.';
  }
  if (!description) return error;
  return code ? `${description} (${code})` : description;
}
