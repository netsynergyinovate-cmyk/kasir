import { createClient } from '@supabase/supabase-js'

// Pastikan variabel lingkungan terbaca
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERROR: Supabase URL atau Key tidak ditemukan di .env!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fungsi tes koneksi sederhana
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('customers').select('count', { count: 'exact', head: true })
    if (error) throw error
    console.log('✅ Supabase Terhubung: Berhasil akses tabel customers.')
    return true
  } catch (err) {
    console.error('❌ Gagal Konek Supabase:', err.message)
    return false
  }
}
