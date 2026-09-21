import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Klien Supabase dengan service_role (melewati RLS) — HANYA dipakai di Vercel Function (server-side),
// tidak pernah di kode frontend/src/.
export function getServiceClient() {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set. Isi di .env.local (lokal) atau Environment Variables Vercel, lalu restart/deploy ulang.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
