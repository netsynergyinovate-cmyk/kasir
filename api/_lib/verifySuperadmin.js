import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from './supabaseAdmin.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Memverifikasi bahwa permintaan datang dari staf (admin ATAU superadmin) yang sedang login, lewat
// token sesi browsernya sendiri (header Authorization: Bearer <access_token>), bukan lewat key
// rahasia. Dipakai untuk aksi yang aman diakses siapa pun yang login (mis. baca-baca), bukan aksi
// sensitif superadmin-only (pakai verifySuperadmin untuk itu).
export async function verifyStaff(req) {
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

  if (profileError || !callerProfile) {
    return { error: { status: 403, message: 'Akun ini belum terdaftar sebagai staf KAsir.' } };
  }

  return { adminClient, callerId: callerData.user.id, role: callerProfile.role };
}

// Memverifikasi bahwa permintaan datang dari superadmin yang sedang login. Dibangun di atas
// verifyStaff, lalu menolak kalau rolenya bukan superadmin.
export async function verifySuperadmin(req) {
  const staff = await verifyStaff(req);
  if (staff.error) return staff;

  if (staff.role !== 'superadmin') {
    return { error: { status: 403, message: `Hanya superadmin yang boleh melakukan aksi ini. [role: ${staff.role}]` } };
  }

  return staff;
}
