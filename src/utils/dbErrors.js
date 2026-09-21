// Pesan galat yang bisa ditindaklanjuti untuk fitur rute kunjungan.
export function describeRouteError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;

  const missingSchema = /42703|PGRST204|PGRST205|does not exist|schema cache/i.test(text);
  if (missingSchema) {
    return 'Database belum disiapkan untuk fitur rute. Jalankan file supabase_customer_routes.sql di Supabase SQL Editor, lalu coba lagi.';
  }

  if (/42501|row-level security/i.test(text)) {
    return 'Anda tidak memiliki izin untuk melakukan aksi ini.';
  }

  return error?.message || 'Terjadi kesalahan tak dikenal.';
}
