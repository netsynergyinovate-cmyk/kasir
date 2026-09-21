import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat variabel lingkungan dari file .env jika belum ada
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan!');
  process.exit(1);
}

async function pingSupabase() {
  console.log(`📡 Menghubungi Supabase API di: ${supabaseUrl}`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/ping_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ source: 'github_action' })
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      console.log(`✅ Supabase Ping Berhasil! (${duration}ms) - Database tetap aktif.`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Ping Gagal dengan Status ${response.status}: ${errorText}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Terjadi kesalahan jaringan saat ping Supabase:', error.message);
    process.exit(1);
  }
}

pingSupabase();
