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
    const { error } = await supabase.from('customers').select('count', { count: 'exact', head: true })
    if (error) throw error
    console.log('✅ Supabase Terhubung: Berhasil akses tabel customers.')
    return true
  } catch (err) {
    console.error('❌ Gagal Konek Supabase:', err.message)
    return false
  }
}

/**
 * Fungsi Ping Supabase (Keep-Alive Database)
 * Mencegah Supabase Free Tier di-pause/dinonaktifkan akibat inaktivitas.
 */
export const pingDatabase = async (source = 'web_client') => {
  try {
    // 1. Coba catat ke tabel ping_logs jika ada
    const { error: insertError } = await supabase
      .from('ping_logs')
      .insert([{ source }])

    // 2. Jika tabel ping_logs belum dibuat, fallback lakukan query ringan ke customers
    if (insertError) {
      const { error: queryError } = await supabase
        .from('customers')
        .select('count', { count: 'exact', head: true })
      
      if (queryError) throw queryError
    }

    console.log(`📡 [${new Date().toLocaleString()}] Ping Supabase Berhasil (${source})`)
    return true
  } catch (err) {
    console.warn('⚠️ Warning Ping Supabase:', err.message)
    return false
  }
}

// Jalankan ping otomatis saat aplikasi dimuat pertama kali
pingDatabase('app_init')

// Interval otomatis setiap 24 jam (24 * 60 * 60 * 1000 ms) saat tab/app terbuka
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
setInterval(() => {
  pingDatabase('app_interval_24h')
}, TWENTY_FOUR_HOURS_MS)

