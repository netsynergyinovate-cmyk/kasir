import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Klien Supabase dengan service_role (melewati RLS) — HANYA dipakai di Vercel Function (server-side),
// tidak pernah di kode frontend/src/. process.env dibaca di sini (bukan di top-level modul) supaya
// skrip lokal yang memuat .env.local setelah import tetap melihat nilainya.
export function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set. Isi di .env.local (lokal) atau Environment Variables Vercel, lalu restart/deploy ulang.');
  }
  return createClient(process.env.VITE_SUPABASE_URL, serviceRoleKey);
}
