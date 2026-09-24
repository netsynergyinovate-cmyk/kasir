import process from 'node:process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { verifyStaff, verifySuperadmin } from '../_lib/verifySuperadmin.js';
import { getServiceClient } from '../_lib/supabaseAdmin.js';
import { sendWatbizMessage, registerWatbizWebhook, getWatbizProfile } from '../_lib/watbizClient.js';
import { syncPayment } from '../_lib/paymentSync.js';
import {
  cleanPhoneNumber,
  formatPaymentInvoiceMessage,
  formatDueReminderMessage,
  formatAutoPaymentConfirmedMessage,
  formatUnregisteredNumberMessage,
  formatProofPhotoRequiredMessage,
} from '../../src/utils/whatsappTemplates.js';
import { formatRupiah } from '../../src/utils/format.js';

const TEST_MESSAGE = 'Tes koneksi Watbiz dari KAsir berhasil ✅';

// Webhook inbound bisa membuat transaksi LUNAS otomatis, jadi wajib diautentikasi dengan secret bersama.
// Secret dikirim Watbiz lewat query `?secret=` di URL webhook (ditambahkan otomatis saat register-webhook)
// atau header `x-webhook-secret`.
function checkWebhookSecret(req) {
  const expected = process.env.WATBIZ_WEBHOOK_SECRET || '';
  if (!expected) {
    return { ok: false, status: 503, error: 'WATBIZ_WEBHOOK_SECRET belum dikonfigurasi di server.' };
  }

  let provided = req.headers?.['x-webhook-secret'] || req.query?.secret || '';
  if (!provided && req.url) {
    try {
      provided = new URL(req.url, 'http://localhost').searchParams.get('secret') || '';
    } catch { /* URL tidak valid: anggap tanpa secret */ }
  }

  const digest = (v) => createHash('sha256').update(String(v)).digest();
  if (!timingSafeEqual(digest(provided), digest(expected))) {
    return { ok: false, status: 401, error: 'Webhook secret tidak valid.' };
  }
  return { ok: true };
}

// Secret tidak boleh muncul di log maupun respons yang bisa dilihat staff.
function redactSecret(value) {
  const secret = process.env.WATBIZ_WEBHOOK_SECRET || '';
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return secret ? text.split(secret).join('***') : text;
}

function redactBody(body) {
  return typeof body === 'string' ? redactSecret(body) : JSON.parse(redactSecret(body));
}

function withWebhookSecret(webhookUrl) {
  const secret = process.env.WATBIZ_WEBHOOK_SECRET || '';
  if (!secret || /[?&]secret=/.test(webhookUrl)) return webhookUrl;
  return `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}secret=${encodeURIComponent(secret)}`;
}

/**
 * Ekstraksi mendalam URL media/foto dari segala macam format webhook (Watbiz, Baileys, Meta, WPPConnect)
 */
function extractAnyMediaUrl(obj) {
  if (!obj) return null;
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:image/')) {
      return s;
    }
    if (s.length > 100 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 100))) {
      return `data:image/jpeg;base64,${s}`;
    }
    return null;
  }
  if (typeof obj !== 'object') return null;

  // 1. Cek langsung properti kunci
  const directKeys = [
    'media_url', 'mediaUrl', 'imageUrl', 'image_url', 'file_url', 'fileUrl',
    'url', 'image', 'media', 'file', 'attachment', 'link', 'downloadUrl', 'download_url'
  ];
  for (const k of directKeys) {
    const val = obj[k];
    if (typeof val === 'string') {
      const s = val.trim();
      if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:image/')) {
        return s;
      }
      if (s.length > 100 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 100))) {
        return `data:image/jpeg;base64,${s}`;
      }
    }
  }

  // 2. Cek thumbnail / base64 WhatsApp (jpegThumbnail)
  const thumbKeys = ['jpegThumbnail', 'base64', 'image_base64', 'file_base64'];
  for (const k of thumbKeys) {
    const val = obj[k];
    if (typeof val === 'string' && val.length > 20) {
      return val.startsWith('data:') ? val : `data:image/jpeg;base64,${val}`;
    }
  }

  // 3. Cek nested object
  if (obj.imageMessage && typeof obj.imageMessage === 'object') {
    const res = extractAnyMediaUrl(obj.imageMessage);
    if (res) return res;
  }
  if (obj.documentMessage && typeof obj.documentMessage === 'object') {
    const res = extractAnyMediaUrl(obj.documentMessage);
    if (res) return res;
  }
  if (obj.message && typeof obj.message === 'object') {
    const res = extractAnyMediaUrl(obj.message);
    if (res) return res;
  }
  if (obj.data && typeof obj.data === 'object') {
    const res = extractAnyMediaUrl(obj.data);
    if (res) return res;
  }
  if (Array.isArray(obj.messages) && obj.messages.length > 0) {
    const res = extractAnyMediaUrl(obj.messages[0]);
    if (res) return res;
  }
  if (Array.isArray(obj.entry) && obj.entry.length > 0) {
    const res = extractAnyMediaUrl(obj.entry[0]);
    if (res) return res;
  }

  return null;
}


/**
 * Helper ekstraksi pesan & nomor dari webhook Watbiz yang fleksibel
 */
function parseWebhookPayload(rawPayload = {}) {
  let body = rawPayload;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      try {
        const params = new URLSearchParams(body);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        body = obj;
      } catch {
        body = {};
      }
    }
  }

  // Jika payload data berupa string JSON bertingkat (sering terjadi pada webhook proxy)
  if (typeof body.data === 'string' && (body.data.startsWith('{') || body.data.startsWith('['))) {
    try {
      body.data = JSON.parse(body.data);
    } catch { /* biarkan data tetap string */ }
  }

  // 1. Ekstraksi nomor pengirim dari berbagai format gateway (Watbiz, Baileys, WPPConnect, Meta Cloud)
  const rawFrom =
    body.phone ||
    body.number ||
    body.from ||
    body.sender ||
    body.sender_number ||
    body.sender_phone ||
    body.wa_number ||
    body.chatId ||
    body.participant ||
    body.data?.phone ||
    body.data?.number ||
    body.data?.from ||
    body.data?.sender ||
    body.data?.sender_number ||
    body.data?.sender_phone ||
    body.data?.wa_number ||
    body.data?.chatId ||
    body.data?.participant ||
    body.data?.contact?.phone ||
    body.contact?.phone ||
    body.data?.key?.remoteJid ||
    body.key?.remoteJid ||
    body.message?.key?.remoteJid ||
    body.data?.remoteJid ||
    body.remoteJid ||
    body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id ||
    body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
    body.messages?.[0]?.key?.remoteJid ||
    body.messages?.[0]?.from ||
    '';

  const senderPhone = cleanPhoneNumber(rawFrom);

  const senderName =
    body.push_name ||
    body.data?.push_name ||
    body.data?.pushName ||
    body.pushName ||
    body.data?.name ||
    body.name ||
    body.data?.sender_name ||
    body.sender_name ||
    body.data?.notifyName ||
    body.notifyName ||
    '';

  const messageId =
    body.message_id ||
    body.data?.message_id ||
    body.id ||
    body.data?.id ||
    body.key?.id ||
    body.data?.key?.id ||
    body.message?.key?.id ||
    '';

  // Jangan tangani pesan yang dikirim oleh bot/nomor sendiri (fromMe)
  const isFromMe = Boolean(
    body.key?.fromMe ||
    body.data?.key?.fromMe ||
    body.message?.key?.fromMe ||
    body.fromMe ||
    body.data?.fromMe
  );

  // 2. Ekstraksi teks / caption pesan
  const text = (
    body.message?.conversation ||
    body.data?.message?.conversation ||
    body.message?.extendedTextMessage?.text ||
    body.data?.message?.extendedTextMessage?.text ||
    body.message?.imageMessage?.caption ||
    body.data?.message?.imageMessage?.caption ||
    body.message?.documentMessage?.caption ||
    body.data?.message?.documentMessage?.caption ||
    body.data?.message ||
    body.data?.text ||
    body.data?.caption ||
    body.caption ||
    body.body ||
    (typeof body.message === 'string' ? body.message : '') ||
    (typeof body.text === 'string' ? body.text : '') ||
    (typeof body.data === 'string' ? body.data : '') ||
    ''
  ).trim();

  // 3. Ekstraksi URL media / bukti transfer asli dari client
  const mediaUrl = extractAnyMediaUrl(body);

  // 4. Deteksi apakah pesan adalah gambar / dokumen bukti bayar
  const isImage =
    Boolean(mediaUrl) ||
    body.type === 'image' ||
    body.type === 'photo' ||
    body.type === 'media' ||
    body.type === 'document' ||
    body.data?.type === 'image' ||
    body.data?.type === 'photo' ||
    body.data?.type === 'media' ||
    body.data?.type === 'document' ||
    body.messageType === 'imageMessage' ||
    body.data?.messageType === 'imageMessage' ||
    body.messageType === 'documentMessage' ||
    body.data?.messageType === 'documentMessage' ||
    Boolean(body.message?.imageMessage) ||
    Boolean(body.data?.message?.imageMessage) ||
    Boolean(body.message?.documentMessage) ||
    Boolean(body.data?.message?.documentMessage) ||
    body.mediaType === 'image' ||
    body.data?.mediaType === 'image' ||
    Boolean(body.image) ||
    Boolean(body.data?.image) ||
    Boolean(body.document) ||
    Boolean(body.data?.document) ||
    Boolean(body.mimetype?.startsWith('image/')) ||
    Boolean(body.data?.mimetype?.startsWith('image/')) ||
    Boolean(body.mime_type?.startsWith('image/')) ||
    Boolean(body.data?.mime_type?.startsWith('image/'));

  return {
    senderPhone,
    rawSender: rawFrom,
    senderName,
    messageId,
    text,
    mediaUrl,
    isImage,
    isFromMe,
    parsedBody: body
  };
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

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      try {
        const params = new URLSearchParams(body);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        body = obj;
      } catch { /* body tetap string */ }
    }
  }

  const action = body.action || req.query?.action;
  const isWebhook = !action || action === 'webhook' || Boolean(req.url?.includes('webhook')) || Boolean(body.event) || Boolean(body.data);

  // =========================================================================
  // 2. INBOUND WEBHOOK (Diterima dari Watbiz saat pelanggan mengirim pesan/bukti)
  // =========================================================================
  if (isWebhook && (!action || action === 'webhook')) {
    const secretCheck = checkWebhookSecret(req);
    if (!secretCheck.ok) {
      res.status(secretCheck.status).json({ error: secretCheck.error });
      return;
    }

    let adminClient;
    try {
      adminClient = getServiceClient();
    } catch (e) {
      console.error('Inbound webhook Supabase admin error:', e.message);
      res.status(500).json({ error: 'Database service unavailable' });
      return;
    }

    const { senderPhone, rawSender, senderName, messageId, text, mediaUrl, isImage, isFromMe } = parseWebhookPayload(body);

    // Cari data pelanggan lebih awal untuk log yang lengkap
    let customer = null;
    // 'phone' = nomor pengirim cocok dengan nomor terdaftar; 'name' = hanya kemiripan nama (tidak boleh auto-bayar)
    let matchedBy = null;
    const isLid = Boolean(rawSender && String(rawSender).includes('@lid')) || (senderPhone && senderPhone.length >= 14);

    // 1. Coba cari berdasarkan nomor telepon jika bukan LID murni
    if (senderPhone && !isLid) {
      const lastDigits = senderPhone.slice(-8);
      let matchedCustomers = null;
      try {
        const custQuery = adminClient.from('customers').select('*');
        if (typeof custQuery.ilike === 'function') {
          const { data } = await custQuery.ilike('phone', `%${lastDigits}%`);
          matchedCustomers = data;
        } else if (typeof custQuery.not === 'function') {
          const { data } = await custQuery.not('phone', 'is', null);
          matchedCustomers = data;
        } else {
          const { data } = await custQuery;
          matchedCustomers = data;
        }
      } catch (e) {
        console.warn('Error querying customers for log:', e.message);
      }

      customer = matchedCustomers?.find((c) => {
        const cleanDb = cleanPhoneNumber(c.phone);
        if (!cleanDb) return false;
        return (
          cleanDb === senderPhone ||
          (cleanDb.length >= 8 && senderPhone.endsWith(cleanDb.slice(-8))) ||
          (senderPhone.length >= 8 && cleanDb.endsWith(senderPhone.slice(-8)))
        );
      }) || null;
      if (customer) matchedBy = 'phone';
    }

    // 2. Jika belum cocok (atau jika pengirim adalah WhatsApp LID), cari berdasarkan nama / push_name
    if (!customer) {
      try {
        const query = adminClient.from('customers').select('*');
        let allCustomers = [];
        if (typeof query?.then === 'function') {
          const res = await query;
          allCustomers = res?.data || [];
        } else if (typeof query?.ilike === 'function') {
          const res = await query.ilike('name', '%%');
          allCustomers = res?.data || [];
        }
        if (allCustomers && allCustomers.length > 0) {
          // A. Token matching: push_name vs customer.name
          if (senderName) {
            const sTokens = senderName.toLowerCase().split(/[\s,.-]+/).filter((t) => t.length >= 3);
            if (sTokens.length > 0) {
              customer = allCustomers.find((c) => {
                const cTokens = (c.name || '').toLowerCase().split(/[\s,.-]+/).filter((t) => t.length >= 3);
                // Nama depan cocok persis
                if (cTokens.length > 0 && sTokens[0] === cTokens[0]) return true;
                // Atau token nama unik cocok
                return sTokens.some((st) => cTokens.includes(st));
              }) || null;
              if (customer) matchedBy = 'name';
            }
          }

          // B. Cek apakah ada nomor telepon di caption pesan
          if (!customer && text) {
            const foundPhone = text.match(/(?:08|628)[0-9]{8,12}/);
            if (foundPhone) {
              const cleanFound = cleanPhoneNumber(foundPhone[0]);
              customer = allCustomers.find((c) => cleanPhoneNumber(c.phone) === cleanFound) || null;
              if (customer) matchedBy = 'phone';
            }
            if (!customer) {
              customer = allCustomers.find((c) => {
                if (!c.name) return false;
                const cFirst = c.name.split(' ')[0].toLowerCase();
                return cFirst.length >= 3 && text.toLowerCase().includes(cFirst);
              }) || null;
              if (customer) matchedBy = 'name';
            }
          }
        }
      } catch (e) {
        console.warn('Error querying all customers for name match:', e.message);
      }
    }

    // Tentukan nomor telepon tujuan balasan yang valid (prioritaskan nomor HP riil pelanggan dari DB jika pengirim adalah @lid)
    const effectivePhone = (customer?.phone ? cleanPhoneNumber(customer.phone) : '') || (isLid ? '' : senderPhone) || senderPhone;
    const displayName = customer ? (senderName && !customer.name.toLowerCase().includes(senderName.toLowerCase()) ? `${customer.name} (${senderName})` : customer.name) : (senderName || null);

    // Foto bukti asli dari webhook (hanya jika ada file/URL foto asli yang dikirimkan pelanggan)
    const realMediaUrl = isImage ? (mediaUrl || null) : null;

    // Catat log awal seluruh pesan masuk agar selalu transparan dan terpantau detail di Pengaturan
    let inboundLogId = null;
    try {
      const logInsertRes = await adminClient.from('watbiz_logs').insert({
        phone_number: effectivePhone || senderPhone || 'NO_PHONE',
        message: text 
          ? (isImage ? `[Foto Bukti Masuk] ${text}` : text) 
          : (isImage ? '[Foto Bukti Pembayaran 📸]' : '[Pesan Masuk Tanpa Teks]'),
        kind: isImage ? 'inbound_proof' : 'inbound',
        status: isFromMe ? 'ignored_from_me' : (senderPhone ? 'received' : 'ignored_no_phone'),
        sender_name: displayName,
        response_detail: JSON.stringify({
          phone: effectivePhone || senderPhone,
          customerName: customer?.name || null,
          senderName: senderName || null,
          isImage,
          mediaUrl: realMediaUrl,
          whatsappMessageId: messageId || null,
          needsPhotoAttachment: isImage && !realMediaUrl,
          caption: text || null,
          type: isImage ? 'image' : 'text',
          rawSnippet: typeof body === 'object' ? JSON.stringify(body).slice(0, 1000) : String(body).slice(0, 1000)
        }),
      });
      // Ambil ID baris yang baru disisipkan jika didukung
      if (logInsertRes?.data?.[0]?.id) {
        inboundLogId = logInsertRes.data[0].id;
      }
    } catch (logErr) {
      console.warn('Gagal mencatat inbound watbiz_logs:', logErr.message);
    }

    // Abaikan jika pesan berasal dari bot sendiri (outgoing)
    if (isFromMe) {
      res.status(200).json({ ok: true, message: 'Skipped: Outgoing message from bot' });
      return;
    }

    if (!senderPhone && !effectivePhone) {
      res.status(200).json({ ok: true, message: 'Skipped: No valid sender phone in payload' });
      return;
    }

    // Ambil token Watbiz & info perusahaan dari company_settings
    const { data: settings } = await adminClient.from('company_settings').select('*').eq('id', 1).maybeSingle();
    const watbizToken = settings?.watbiz_token || process.env.WATBIZ_TOKEN || '';
    const watbizEnabled = settings?.watbiz_enabled ?? true;

    // A. Nomor belum terdaftar di database pelanggan
    if (!customer) {
      if (watbizEnabled && watbizToken && effectivePhone && !isLid) {
        const unregMsg = formatUnregisteredNumberMessage(effectivePhone, settings);
        await sendWatbizMessage(watbizToken, { number: effectivePhone, message: unregMsg }).catch(() => {});
      }
      res.status(200).json({ ok: true, status: 'unregistered_customer', phone: senderPhone });
      return;
    }

    // =========================================================================
    // STRICT PAYMENT VERIFICATION:
    // Pelanggan yang hanya mengirim teks ("sudah bayar", "lunas", "transfer", "tf")
    // TIDAK BOLEH langsung dibayarkan/diproses! Bot harus meminta FOTO BUKTI STRUK TRANSFER terlebih dahulu.
    // Pembayaran otomatis HANYA dieksekusi bila isImage === true (mengirim foto/dokumen bukti transfer).
    // =========================================================================
    if (!isImage) {
      const isClaimingPayment =
        /\b(bayar|transfer|tf|lunas|pembayaran|tagihan|trf|terbayar)\b/i.test(text) ||
        /\b(ini|kirim|upload)\s*(bukti|struk|nota|foto|resi)\b/i.test(text);

      if (isClaimingPayment) {
        // Balas minta kirimkan FOTO bukti pembayaran
        let replyOk = false;
        let replyError = null;
        if (watbizEnabled && watbizToken && effectivePhone) {
          const reqMsg = formatProofPhotoRequiredMessage(customer, settings);
          try {
            const replyResult = await sendWatbizMessage(watbizToken, { number: effectivePhone, message: reqMsg });
            replyOk = replyResult.ok;
            if (!replyResult.ok) replyError = replyResult.body?.message || JSON.stringify(replyResult.body);
          } catch (err) {
            replyError = err.message;
          }
        }

        try {
          await adminClient.from('watbiz_logs').insert({
            phone_number: effectivePhone,
            message: `[Minta Foto Bukti] ${customer.name}: "${text}"`,
            kind: 'inbound_request_proof',
            status: replyOk ? 'success' : 'sent_failed',
            sender_name: 'WhatsApp Bot (Auto)',
            response_detail: JSON.stringify({ replyOk, replyError }),
          });
        } catch { /* gagal mencatat log tidak boleh menggagalkan webhook */ }

        res.status(200).json({
          ok: true,
          status: 'proof_photo_required',
          customer: customer.name,
          message: 'Foto bukti transfer diperlukan untuk verifikasi otomatis',
          replySent: replyOk,
          replyError,
        });
        return;
      }

      // Balas panduan jika pelanggan hanya menyapa biasa
      if (watbizEnabled && watbizToken && effectivePhone && /\b(halo|hai|p|pagi|siang|malam|assalamualaikum|tes)\b/i.test(text)) {
        const helpMsg = `Halo Bapak/Ibu *${customer.name}*!\n\nAda yang bisa kami bantu dari *${settings?.name || 'PT Net Synergy Inovate'}*?\n\nUntuk konfirmasi pembayaran internet bulanan, silakan langsung kirimkan *FOTO BUKTI STRUK TRANSFER* Anda di sini 📸. Sistem kami akan otomatis memverifikasi dan memperbarui status layanan internet Anda. Terima kasih! 🙏`;
        await sendWatbizMessage(watbizToken, { number: effectivePhone, message: helpMsg }).catch(() => {});
      }

      res.status(200).json({ ok: true, status: 'message_received_non_payment' });
      return;
    }

    // Kecocokan hanya lewat nama (mis. pengirim @lid) tidak cukup untuk membayarkan tagihan otomatis:
    // foto tidak diverifikasi, jadi salah orang = pelanggan lain tercatat LUNAS. Serahkan ke admin.
    if (matchedBy !== 'phone') {
      try {
        await adminClient.from('watbiz_logs').insert({
          phone_number: effectivePhone || senderPhone || 'NO_PHONE',
          message: `[Perlu Verifikasi Manual] Foto bukti dari "${senderName || 'tanpa nama'}" cocok nama dengan ${customer.name}`,
          kind: 'inbound_manual_review',
          status: 'manual_review_required',
          sender_name: 'WhatsApp Bot (Auto)',
          response_detail: JSON.stringify({
            customerName: customer.name,
            senderName: senderName || null,
            mediaUrl: realMediaUrl,
            whatsappMessageId: messageId || null,
            matchedBy,
          }),
        });
      } catch { /* log opsional */ }

      res.status(200).json({
        ok: true,
        status: 'manual_review_required',
        customer: customer.name,
        message: 'Pengirim hanya cocok lewat nama; pembayaran tidak diproses otomatis',
      });
      return;
    }

    // JIKA isImage === true: PELANGGAN MENGIRIMKAN FOTO BUKTI TRANSFER!
    // B. Mencegah duplikasi cepat (debounce 10 menit jika pelanggan baru saja diverifikasi)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let recentTrx;
    try {
      const trxQuery = adminClient
        .from('transactions')
        .select('*')
        .eq('customer_name', customer.name)
        .gte('date', tenMinutesAgo)
        .eq('status', 'LUNAS');

      const resTrx = typeof trxQuery?.order === 'function'
        ? await trxQuery.order('date', { ascending: false }).limit(1)
        : await trxQuery;

      recentTrx = resTrx?.data || [];
    } catch {
      recentTrx = [];
    }

    if (recentTrx && recentTrx.length > 0) {
      const existing = recentTrx[0];
      let replyOk = false;

      if (watbizEnabled && watbizToken && effectivePhone) {
        const confirmMsg = formatAutoPaymentConfirmedMessage(customer, existing, settings);
        try {
          const replyResult = await sendWatbizMessage(watbizToken, { number: effectivePhone, message: confirmMsg });
          replyOk = replyResult.ok;
        } catch (e) {
          console.warn('Gagal kirim ulang balasan WA:', e.message);
        }
      }
      res.status(200).json({ ok: true, status: 'already_processed_recent', transaction: existing, replySent: replyOk });
      return;
    }

    // C. Tentukan nominal pembayaran: customer.price -> packages table -> settings
    let trxPrice = Number(customer.price) || 0;
    if (trxPrice <= 0 && customer.package) {
      try {
        const { data: matchedPkg } = await adminClient
          .from('packages')
          .select('price')
          .ilike('name', `%${customer.package.trim()}%`)
          .maybeSingle();
        if (matchedPkg?.price) {
          trxPrice = Number(matchedPkg.price);
        }
      } catch { /* lanjut ke sumber harga berikutnya */ }
    }
    if (trxPrice <= 0 && settings?.invoice_internet_packages) {
      const pkgList = Array.isArray(settings.invoice_internet_packages) ? settings.invoice_internet_packages : [];
      const found = pkgList.find((p) => p.name && customer.package && p.name.toLowerCase().includes(customer.package.toLowerCase()));
      if (found?.price) {
        trxPrice = Number(found.price);
      }
    }

    // D. EKSEKUSI PEMBAYARAN OTOMATIS (AUTO-PAYMENT DI KASIR)
    const now = new Date();
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
      price: trxPrice,
      amount_paid: trxPrice,
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

    // 2. Perbarui status pelanggan menjadi aktif dan isi last_payment_date
    await adminClient.from('customers').update({
      status: 'aktif',
      last_payment_date: now.toISOString(),
    }).eq('id', customer.id);

    // 3. Simpan tautan bukti transfer ke runsnet_proofs HANYA jika ada file foto asli riil yang dikirim
    const proofImage = mediaUrl || null;

    if (proofImage) {
      try {
        await adminClient.from('runsnet_proofs').insert({
          transaction_id: newTransaction.id,
          image: proofImage,
          uploaded_by_name: 'WhatsApp Pelanggan',
          created_at: now.toISOString(),
        });
      } catch (proofErr) {
        console.warn('Gagal menyimpan runsnet_proofs:', proofErr.message);
      }
    }

    // Tautkan ID transaksi ke baris log pesan masuk awal agar sinkron di Pengaturan
    if (inboundLogId) {
      try {
        const updatedInboundDetail = {
          phone: effectivePhone || senderPhone,
          customerName: customer.name,
          senderName: senderName || null,
          isImage: true,
          mediaUrl: proofImage,
          transactionId: newTransaction.id,
          invoice: invoiceNumber,
          nominal: trxPrice,
          whatsappMessageId: messageId || null,
          needsPhotoAttachment: !proofImage,
        };
        await adminClient.from('watbiz_logs').update({
          response_detail: JSON.stringify(updatedInboundDetail)
        }).eq('id', inboundLogId);
      } catch (e) {
        console.warn('Gagal update inbound log dengan transactionId:', e.message);
      }
    }

    // 4. Sinkronisasi otomatis ke Runsnet jika terhubung
    try {
      await syncPayment(adminClient, newTransaction);
    } catch (syncErr) {
      console.warn('Runsnet sync note on WA auto-payment:', syncErr.message);
    }

    // 5. Kirim balasan WhatsApp resmi: "Terima kasih atas pembayaran Anda!"
    let replyOk = false;
    let replyError = null;
    if (watbizEnabled && watbizToken && effectivePhone) {
      const confirmMsg = formatAutoPaymentConfirmedMessage(customer, newTransaction, settings);
      try {
        const replyResult = await sendWatbizMessage(watbizToken, { number: effectivePhone, message: confirmMsg });
        replyOk = replyResult.ok;
        if (!replyResult.ok) {
          replyError = replyResult.body?.message || JSON.stringify(replyResult.body);
        }
      } catch (replyErr) {
        replyError = replyErr.message;
        console.warn('Gagal kirim balasan WA:', replyErr.message);
      }
    }

    // 6. Catat log transaksi sukses dengan foto bukti dan rincian lengkap
    try {
      await adminClient.from('watbiz_logs').insert({
        phone_number: effectivePhone,
        message: `Auto-Payment Berhasil: ${customer.name} - ${newTransaction.package_name} (${formatRupiah(newTransaction.price)})`,
        kind: 'auto_payment',
        status: replyOk ? 'success' : 'payment_saved_wa_pending',
        sender_name: 'WhatsApp Bot (Auto)',
        response_detail: JSON.stringify({
          transactionId: newTransaction.id,
          invoice: invoiceNumber,
          customerName: customer.name,
          senderName: senderName || null,
          phone: effectivePhone,
          nominal: trxPrice,
          mediaUrl: proofImage,
          whatsappMessageId: messageId || null,
          needsPhotoAttachment: !proofImage,
          replyOk,
          replyError,
        }),
      });
    } catch (logErr) {
      console.warn('Gagal mencatat log auto_payment:', logErr.message);
    }

    res.status(200).json({
      ok: true,
      status: 'auto_payment_success',
      customer: customer.name,
      transaction: newTransaction,
      proofImage,
      replySent: replyOk,
      replyError,
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

  // B. Action: 'register-webhook' (Daftarkan URL Webhook ke sistem Watbiz via API v2)
  if (action === 'register-webhook') {
    const staff = await verifySuperadmin(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }

    const { token, webhookUrl } = body;
    let finalToken = token;
    if (!finalToken) {
      const { data: setRow } = await staff.adminClient.from('company_settings').select('watbiz_token').eq('id', 1).maybeSingle();
      finalToken = setRow?.watbiz_token || process.env.WATBIZ_TOKEN || '';
    }

    if (!finalToken) {
      res.status(400).json({ error: 'Token Watbiz belum diisi.' });
      return;
    }
    if (!webhookUrl) {
      res.status(400).json({ error: 'URL Webhook wajib diisi.' });
      return;
    }

    let result;
    try {
      result = await registerWatbizWebhook(finalToken, withWebhookSecret(webhookUrl));
    } catch (err) {
      result = { ok: false, status: 0, body: { error: err.message } };
    }

    try {
      await staff.adminClient.from('watbiz_logs').insert({
        phone_number: 'WEBHOOK_CONFIG',
        message: `Daftar Webhook Watbiz: ${webhookUrl}`,
        kind: 'test',
        status: result.ok ? 'success' : 'failed',
        response_detail: redactSecret(result.body).slice(0, 500),
        sender_name: staff.callerId || null,
      });
    } catch (logErr) {
      console.error('Gagal mencatat watbiz_logs:', logErr.message);
    }

    res.status(200).json({ ...result, body: redactBody(result.body) });
    return;
  }

  // C. Action: 'get-webhook' (Mengambil URL Webhook & status akun yang sedang aktif di Watbiz)
  if (action === 'get-webhook') {
    const staff = await verifyStaff(req);
    if (staff.error) {
      res.status(staff.error.status).json({ error: staff.error.message });
      return;
    }

    const { data: setRow } = await staff.adminClient.from('company_settings').select('watbiz_token').eq('id', 1).maybeSingle();
    const finalToken = body.token || setRow?.watbiz_token || process.env.WATBIZ_TOKEN || '';

    if (!finalToken) {
      res.status(400).json({ error: 'Token Watbiz belum diatur di Pengaturan.' });
      return;
    }

    let result;
    try {
      result = await getWatbizProfile(finalToken);
    } catch (err) {
      result = { ok: false, status: 0, body: { error: err.message } };
    }

    const safeBody = redactBody(result.body);
    res.status(200).json({
      ok: result.ok,
      status: result.status,
      webhookUrl: safeBody?.data?.webhook_url || null,
      device: safeBody?.data?.name || null,
      credit: safeBody?.data?.credit ?? null,
      whatsappCredit: safeBody?.data?.whatsapp_credit ?? null,
      raw: safeBody,
    });
    return;
  }


  // C. Action: 'send-invoice' (Kirim Invoice WhatsApp Resmi Pasca-Kasir)
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
    } catch { /* log opsional */ }

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
      } catch {
        failed++;
      }

      // Jeda 300ms antar-pengiriman agar tidak memicu proteksi spam WhatsApp
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (logs.length > 0) {
      try {
        await staff.adminClient.from('watbiz_logs').insert(logs);
      } catch { /* log opsional */ }
    }

    res.status(200).json({ ok: true, total: customers.length, sent, success: sent, failed });
    return;
  }

  res.status(400).json({ error: `Aksi tidak dikenali: ${action}` });
}
