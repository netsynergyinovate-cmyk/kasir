// Uji lokal jalur pipa sinkronisasi Runsnet, TANPA deploy Vercel dan TANPA field Runsnet terisi.
// Mengambil transaksi terbaru dari database (hasil pembayaran sungguhan yang Anda buat di Kasir),
// lalu memanggil logika webhook langsung di Node — seolah-olah dipanggil Supabase Database Webhook.
//
// Cara pakai:
//   1. Pastikan .env.local berisi SUPABASE_SERVICE_ROLE_KEY dan RUNSNET_WEBHOOK_SECRET.
//   2. Buat 1 transaksi LUNAS di Kasir (npm run dev), boleh nominal kecil, boleh dihapus nanti.
//   3. Jalankan: node scripts/simulate-runsnet-webhook.js
//
// Tidak pernah mengirim apa pun ke Runsnet sungguhan pada tahap ini (field masih REPLACE_ME),
// jadi aman dicoba berkali-kali. Yang diuji: transaksi terbaca, saklar company_settings dihormati,
// baris tercatat di runsnet_sync_log, dan percobaan kedua pada transaksi yang sama tidak dobel.
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServiceClient } from '../api/_lib/supabaseAdmin.js';
import handler from '../api/runsnet/webhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Baca .env dan .env.local secara manual (tanpa dependency tambahan): baris KEY=VALUE sederhana.
function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

async function callWebhook(transaction) {
  const req = {
    method: 'POST',
    headers: { 'x-webhook-secret': process.env.RUNSNET_WEBHOOK_SECRET },
    body: { type: 'INSERT', table: 'transactions', record: transaction },
  };
  const res = makeRes();
  await handler(req, res);
  return res;
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY belum ada di .env / .env.local.');
    process.exit(1);
  }
  if (!process.env.RUNSNET_WEBHOOK_SECRET) {
    console.error('❌ RUNSNET_WEBHOOK_SECRET belum ada di .env / .env.local (boleh string bebas untuk uji lokal).');
    process.exit(1);
  }

  const supabase = getServiceClient();
  const { data: transaction, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !transaction) {
    console.error('❌ Tidak ada transaksi ditemukan. Buat 1 transaksi LUNAS di Kasir dulu.', error?.message || '');
    process.exit(1);
  }

  console.log(`📦 Transaksi terbaru: ${transaction.id} · ${transaction.customer_name || transaction.instansi_name || '(tanpa nama)'} · ${transaction.status} · Rp${transaction.price}`);

  console.log('\n--- Panggilan ke-1 (simulasi webhook Supabase) ---');
  const res1 = await callWebhook(transaction);
  console.log(`HTTP ${res1.statusCode}`, res1.body);

  console.log('\n--- Panggilan ke-2 dengan transaksi SAMA (menguji anti-dobel) ---');
  const res2 = await callWebhook(transaction);
  console.log(`HTTP ${res2.statusCode}`, res2.body);

  const { data: logRow } = await supabase
    .from('runsnet_sync_log')
    .select('*')
    .eq('transaction_id', transaction.id)
    .maybeSingle();

  console.log('\n📋 Baris di runsnet_sync_log:', logRow);
  console.log('\nSelesai. Baris log di atas juga akan muncul di panel Sinkronisasi Runsnet, Pengaturan.');
}

main();
