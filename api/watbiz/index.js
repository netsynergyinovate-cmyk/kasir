import { verifyStaff, verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { sendWatbizMessage, sendWatbizMedia } from '../_lib/watbizClient.js';
import { syncPayment } from '../_lib/paymentSync.js';
import {
  cleanPhoneNumber,
  formatPaymentInvoiceMessage,
  formatDueReminderMessage,
  formatAutoPaymentConfirmedMessage,
  formatAlreadyPaidMessage,
  formatUnregisteredNumberMessage,
} from '../../src/utils/whatsappTemplates.js';

const TEST_MESSAGE = 'Tes koneksi Watbiz dari KAsir berhasil ✅';

/**
 * Helper ekstraksi pesan & nomor dari webhook Watbiz yang fleksibel
 */
function parseWebhookPayload(body = {}) {
  const rawFrom = body.phone || body.from || body.sender || body.data?.from || body.data?.sender || body.data?.remoteJid || body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || '';
  const senderPhone = cleanPhoneNumber(rawFrom);

  const text = (
    body.message?.conversation ||
    body.message?.extendedTextMessage?.text ||
    body.message?.imageMessage?.caption ||
    body.data?.message ||
    body.data?.text ||
    body.data?.caption ||
    (typeof body.message === 'string' ? body.message : '') ||
    (typeof body.text === 'string' ? body.text : '') ||
    ''
  ).trim();

  const mediaUrl = body.media_url || body.mediaUrl || body.data?.media_url || body.data?.mediaUrl || body.imageUrl || body.data?.imageUrl || null;
  const isImage = Boolean(mediaUrl) || body.type === 'image' || body.data?.type === 'image' || Boolean(body.message?.imageMessage);

  return { senderPhone, text, mediaUrl, isImage };
}

export default async function handler(req, res) {
  // 1. GET: Webhook verification / health check
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'kasir-watbiz-dispatcher', time: new Date().toISOString() });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const action = body.action || req.query?.action;
  const isWebhook = !action || action === 'webhook' || Boolean(req.url?.includes('webhook')) || Boolean(body.event) || Boolean(body.data);

  // =========================================================================
  // 2. INBOUND WEBHOOK (Diterima dari Watbiz saat pelanggan mengirim pesan/bukti)
  // =========================================================================
  if (isWebhook && (!action || action === 'webhook')) {
    let adminClient;
    try {
      adminClient = getServiceClient();
    } catch (e) {
      console.error('Inbound webhook Supabase admin error:', e.message);
      res.status(500).json({ error: 'Database service unavailable' });
      return;
    }

    const { senderPhone, text, mediaUrl, isImage } = parseWebhookPayload(body);
    if (!senderPhone) {
      res.status(200).json({ ok: true, message: 'Skipped: No valid sender phone in payload' });
      return;
    }

    // Ambil token Watbiz & info perusahaan dari company_settings
    const { data: settings } = await adminClient.from('company_settings').select('*').eq('id', 1).maybeSingle();
    const watbizToken = settings?.watbiz_token || process.env.WATBIZ_TOKEN || '';
    const watbizEnabled = settings?.watbiz_enabled ?? true;

    // Catat log awal pesan masuk
    try {
      await adminClient.from('watbiz_logs').insert({
        phone_number: senderPhone,
        message: text || (isImage ? '[Foto Bukti Transfer]' : '[Pesan Tanpa Teks]'),
        kind: 'inbound',
        status: 'received',
        response_detail: typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      });
    } catch (logErr) {
      console.warn('Gagal mencatat inbound watbiz_logs:', logErr.message);
    }

    // Cari data pelanggan berdasarkan nomor HP (9 digit terakhir untuk mencakup 08xx dan 628xx)
    const lastDigits = senderPhone.slice(-9);
    const { data: matchedCustomers } = await adminClient
      .from('customers')
      .select('*')
      .ilike('phone', `%${lastDigits}%`);

    const customer = matchedCustomers?.find((c) => cleanPhoneNumber(c.phone) === senderPhone) || matchedCustomers?.[0] || null;

    // A. Nomor belum terdaftar di pelanggan
    if (!customer) {
      if (watbizEnabled && watbizToken) {
        const unregMsg = formatUnregisteredNumberMessage(senderPhone, settings);
        await sendWatbizMessage(watbizToken, { number: senderPhone, message: unregMsg }).catch(() => {});
      }
      res.status(200).json({ ok: true, status: 'unregistered_customer', phone: senderPhone });
      return;
    }

    // Periksa apakah pesan terkait pembayaran / transfer
    const isPaymentRelated = isImage || /sudah bayar|sudah transfer|bukti transfer|bukti bayar|lunas|tf|sudah lunas|bayar tagihan|bayar|transfer/i.test(text);

    if (!isPaymentRelated) {
      // Balas pesan panduan jika hanya menyapa biasa
      if (watbizEnabled && watbizToken && /halo|hai|p|pagi|siang|malam|assalamualaikum|tes/i.test(text)) {
        const helpMsg = `Halo Bapak/Ibu *${customer.name}*!\n\nAda yang bisa kami bantu dari *${settings?.name || 'PT Net Synergy Inovate'}*?\n\nUntuk konfirmasi pembayaran internet bulanan, silakan langsung kirimkan foto bukti struk transfer Anda di sini. Sistem akan otomatis memverifikasi dan memperbarui status layanan Anda. Terima kasih! 🙏`;
        await sendWatbizMessage(watbizToken, { number: senderPhone, message: helpMsg }).catch(() => {});
      }
      res.status(200).json({ ok: true, status: 'message_received_non_payment' });
      return;
    }

    // B. Cek apakah pelanggan sudah bayar bulan ini
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: existingTrx } = await adminClient
      .from('transactions')
      .select('*')
      .eq('customer_name', customer.name)
      .gte('date', startOfMonth)
      .eq('status', 'LUNAS');

    if (existingTrx && existingTrx.length > 0) {
      // Pelanggan sudah bayar bulan ini
      if (watbizEnabled && watbizToken) {
        const alreadyPaidMsg = formatAlreadyPaidMessage(customer, settings);
        await sendWatbizMessage(watbizToken, { number: senderPhone, message: alreadyPaidMsg }).catch(() => {});
      }
      res.status(200).json({ ok: true, status: 'already_paid', customer: customer.name });
      return;
    }

    // C. BELUM BAYAR -> OTOMATIS BAYAR (AUTO-PAYMENT DI KASIR)
    const localId = `INV-WA-${Date.now()}`;
    const invoiceNumber = customer.pppoe_id
      ? `INV-${customer.pppoe_id}-${now.getMonth() + 1}${now.getFullYear()}`
      : `INV-${Date.now()}`;

    const newTransaction = {
      id: localId,
      invoice_number: invoiceNumber,
      date: now.toISOString(),
      customer_name: customer.name,
      package_name: customer.package || 'Internet',
      price: Number(customer.price) || 0,
      amount_paid: Number(customer.price) || 0,
      status: 'LUNAS',
      payment_method: 'Transfer WA',
      cashier_name: 'WhatsApp Bot (Auto)',
      type: 'retail',
    };

    // 1. Simpan transaksi lunas baru
    const { error: trxErr } = await adminClient.from('transactions').insert([newTransaction]);
    if (trxErr) {
      console.error('Gagal membuat transaksi auto-payment WA:', trxErr.message);
      res.status(500).json({ error: 'Gagal mencatat transaksi pembayaran otomatis: ' + trxErr.message });
      return;
    }

    // 2. Perbarui status pelanggan menjadi aktif
    await adminClient.from('customers').update({
      status: 'aktif',
      last_payment_date: now.toISOString(),
    }).eq('id', customer.id);

    // 3. Simpan tautan bukti transfer jika ada media
    if (mediaUrl) {
      try {
        await adminClient.from('runsnet_proofs').insert({
          transaction_id: newTransaction.id,
          proof_url: mediaUrl,
          note: 'Otomatis diunggah dari kiriman bukti transfer WhatsApp pelanggan',
        });
      } catch (proofErr) {
        console.warn('Gagal menyimpan runsnet_proofs:', proofErr.message);
      }
    }

    // 4. Sinkronisasi otomatis ke Runsnet jika terhubung
    try {
      await syncPayment(adminClient, newTransaction);
    } catch (syncErr) {
      console.warn('Runsnet sync note on WA auto-payment:', syncErr.message);
    }

    // 5. Kirim balasan WhatsApp bukti pembayaran berhasil
    let replyOk = false;
    if (watbizEnabled && watbizToken) {
      const confirmMsg = formatAutoPaymentConfirmedMessage(customer, newTransaction, settings);
      try {
        const replyResult = await sendWatbizMessage(watbizToken, { number: senderPhone, message: confirmMsg });
        replyOk = replyResult.ok;
      } catch (replyErr) {
        console.warn('Gagal kirim balasan WA:', replyErr.message);
      }
    }

    // 6. Catat log transaksi sukses
    try {
      await adminClient.from('watbiz_logs').insert({
        phone_number: senderPhone,
        message: `Auto-Payment Berhasil: ${customer.name} - ${newTransaction.package_name} (${newTransaction.price})`,
        kind: 'auto_payment',
        status: replyOk ? 'success' : 'payment_saved_wa_pending',
        sender_name: 'WhatsApp Bot (Auto)',
        response_detail: JSON.stringify({ transactionId: newTransaction.id, invoice: invoiceNumber }),
      });
    } catch {}

    res.status(200).json({
      ok: true,
      status: 'auto_payment_success',
      transaction: newTransaction,
      customer: customer.name,
      replySent: replyOk,
    });
    return;
  }

  // =========================================================================
  // 3. OUTBOUND ACTIONS (Dipicu dari aplikasi KAsir)
  // =========================================================================

  // A. Action: 'ping' (Uji koneksi test message, sebelumnya di ping.js)
  if (action === 'ping') {
    const staff = await verifySuperadmin(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }

    const { token, to, senderName } = body;
    if (!token) {
      res.status(400).json({ error: 'Token Watbiz belum diisi.' });
      return;
    }
    if (!to) {
      res.status(400).json({ error: 'Nomor tujuan tes belum diisi.' });
      return;
    }

    const targetPhone = cleanPhoneNumber(to);
    let result;
    try {
      result = await sendWatbizMessage(token, { number: targetPhone, message: TEST_MESSAGE });
    } catch (err) {
      result = { ok: false, status: 0, body: { error: err.message } };
    }

    try {
      await staff.adminClient.from('watbiz_logs').insert({
        phone_number: targetPhone,
        message: TEST_MESSAGE,
        kind: 'test',
        status: result.ok ? 'success' : 'failed',
        response_detail: typeof result.body === 'string' ? result.body.slice(0, 500) : JSON.stringify(result.body).slice(0, 500),
        sender_name: senderName || null,
      });
    } catch (logErr) {
      console.error('Gagal mencatat watbiz_logs:', logErr.message);
    }

    res.status(200).json(result);
    return;
  }

  // B. Action: 'send-invoice' (Kirim Invoice WhatsApp Resmi Pasca-Kasir)
  if (action === 'send-invoice') {
    const staff = await verifyStaff(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }

    const { transaction, customer, companyInfo, senderName } = body;
    if (!transaction) {
      res.status(400).json({ error: 'Data transaksi diperlukan.' });
      return;
    }

    const phone = cleanPhoneNumber(customer?.phone || transaction?.customerPhone || transaction?.phone);
    if (!phone) {
      res.status(400).json({ error: 'Pelanggan tidak memiliki nomor WhatsApp yang valid.' });
      return;
    }

    // Ambil token Watbiz dari settings atau request
    const token = companyInfo?.watbizToken || body.token;
    if (!token) {
      res.status(400).json({ error: 'Integrasi WhatsApp belum aktif atau token Watbiz belum diatur.' });
      return;
    }

    const message = formatPaymentInvoiceMessage(transaction, customer, companyInfo);
    let result;
    try {
      result = await sendWatbizMessage(token, { number: phone, message });
    } catch (err) {
      result = { ok: false, status: 0, body: { error: err.message } };
    }

    try {
      await staff.adminClient.from('watbiz_logs').insert({
        phone_number: phone,
        message,
        kind: 'invoice',
        status: result.ok ? 'success' : 'failed',
        response_detail: typeof result.body === 'string' ? result.body.slice(0, 500) : JSON.stringify(result.body).slice(0, 500),
        sender_name: senderName || staff.callerId || null,
      });
    } catch (logErr) {
      console.warn('Log error:', logErr.message);
    }

    res.status(200).json(result);
    return;
  }

  // C. Action: 'send-reminder' (Kirim Pengingat Jatuh Tempo & Peringatan Isolir ke 1 Pelanggan)
  if (action === 'send-reminder') {
    const staff = await verifyStaff(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }

    const { customer, daysLeft = 1, companyInfo, senderName } = body;
    if (!customer) {
      res.status(400).json({ error: 'Data pelanggan diperlukan.' });
      return;
    }

    const phone = cleanPhoneNumber(customer.phone);
    if (!phone) {
      res.status(400).json({ error: 'Pelanggan tidak memiliki nomor WhatsApp.' });
      return;
    }

    const token = companyInfo?.watbizToken || body.token;
    if (!token) {
      res.status(400).json({ error: 'Token Watbiz belum diatur.' });
      return;
    }

    const message = formatDueReminderMessage(customer, daysLeft, companyInfo);
    let result;
    try {
      result = await sendWatbizMessage(token, { number: phone, message });
    } catch (err) {
      result = { ok: false, status: 0, body: { error: err.message } };
    }

    try {
      await staff.adminClient.from('watbiz_logs').insert({
        phone_number: phone,
        message,
        kind: 'reminder',
        status: result.ok ? 'success' : 'failed',
        response_detail: typeof result.body === 'string' ? result.body.slice(0, 500) : JSON.stringify(result.body).slice(0, 500),
        sender_name: senderName || staff.callerId || null,
      });
    } catch {}

    res.status(200).json(result);
    return;
  }

  // D. Action: 'send-reminders' (Kirim Pengingat Jatuh Tempo & Peringatan Isolir Masal / Batch)
  if (action === 'send-reminders') {
    const staff = await verifyStaff(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }

    const { customers = [], companyInfo, senderName } = body;
    const token = companyInfo?.watbizToken || body.token;
    if (!token) {
      res.status(400).json({ error: 'Token Watbiz belum diatur.' });
      return;
    }

    let sent = 0;
    let failed = 0;
    const logs = [];

    for (const cust of customers) {
      const phone = cleanPhoneNumber(cust.phone);
      if (!phone) {
        failed++;
        continue;
      }

      const daysLeft = Number(cust.daysLeft ?? 1);
      const message = formatDueReminderMessage(cust, daysLeft, companyInfo);

      try {
        const resKirim = await sendWatbizMessage(token, { number: phone, message });
        if (resKirim.ok) sent++; else failed++;
        logs.push({
          phone_number: phone,
          message,
          kind: 'reminder',
          status: resKirim.ok ? 'success' : 'failed',
          sender_name: senderName || null,
        });
      } catch (e) {
        failed++;
      }

      // Jeda 300ms antar-pengiriman agar tidak memicu proteksi spam WhatsApp
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (logs.length > 0) {
      try {
        await staff.adminClient.from('watbiz_logs').insert(logs);
      } catch {}
    }

    res.status(200).json({ ok: true, total: customers.length, sent, success: sent, failed });
    return;
  }

  res.status(400).json({ error: `Aksi tidak dikenali: ${action}` });
}
