import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

export function getAdminClient() {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set. Isi di .env.local (lokal) atau Environment Variables Vercel, lalu restart server.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function verifySuperadmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { error: { status: 401, message: 'Token otorisasi tidak ditemukan.' } };
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: callerData, error: callerError } = await anonClient.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return { error: { status: 401, message: 'Token tidak valid.' } };
  }

  const adminClient = getAdminClient();
  const { data: callerProfile, error: profileError } = await adminClient
    .from('admin_profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (profileError || callerProfile?.role !== 'superadmin') {
    return { error: { status: 403, message: 'Hanya superadmin yang boleh melakukan aksi ini.' } };
  }

  return { adminClient, callerId: callerData.user.id };
}
