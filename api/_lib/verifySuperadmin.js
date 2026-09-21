import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from './supabaseAdmin.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Memverifikasi bahwa permintaan datang dari superadmin yang sedang login, lewat token sesi
// browsernya sendiri (header Authorization: Bearer <access_token>), bukan lewat key rahasia.
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

  const adminClient = getServiceClient();
  const { data: callerProfile, error: profileError } = await adminClient
    .from('admin_profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (profileError || callerProfile?.role !== 'superadmin') {
    // Detail diagnostik sementara (aman ditampilkan ke pemilik akun sendiri — cuma user id &
    // role miliknya sendiri, bukan rahasia) supaya mudah melacak penyebab penolakan.
    const detail = profileError
      ? `query error: ${profileError.message}`
      : `user id ${callerData.user.id}, profil ditemukan: ${callerProfile ? 'ya' : 'tidak'}, role: ${callerProfile?.role ?? '(tidak ada)'}`;
    return { error: { status: 403, message: `Hanya superadmin yang boleh melakukan aksi ini. [${detail}]` } };
  }

  return { adminClient, callerId: callerData.user.id };
}
