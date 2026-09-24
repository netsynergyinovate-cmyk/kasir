import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import process from 'node:process';
import process from 'node:process';

vi.mock('../../api/_lib/verifySuperadmin.js', () => ({
  verifySuperadmin: vi.fn(),
  verifyStaff: vi.fn(),
}));

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('../../api/_lib/watbizClient.js', () => ({
  sendWatbizMessage: vi.fn(),
  sendWatbizMedia: vi.fn(),
  registerWatbizWebhook: vi.fn(),
  getWatbizProfile: vi.fn(),
}));

vi.mock('../../api/_lib/paymentSync.js', () => ({
  syncPayment: vi.fn(),
}));

import { verifySuperadmin, verifyStaff } from '../../api/_lib/verifySuperadmin.js';
import { getServiceClient } from '../../api/_lib/supabaseAdmin.js';
import { sendWatbizMessage, registerWatbizWebhook, getWatbizProfile } from '../../api/_lib/watbizClient.js';

import { syncPayment } from '../../api/_lib/paymentSync.js';
import handler from '../../api/watbiz/index.js';

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('Watbiz Dispatcher API (/api/watbiz)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles GET health check / verification', async () => {
    const res = makeRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('kasir-watbiz-dispatcher');
  });

  it('rejects unsupported methods (PUT, DELETE, etc)', async () => {
    const res = makeRes();
    await handler({ method: 'DELETE' }, res);
    expect(res.statusCode).toBe(405);
  });

  describe('Action: ping', () => {
    it('requires superadmin authentication', async () => {
      verifySuperadmin.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
      const res = makeRes();
      await handler({ method: 'POST', body: { action: 'ping' } }, res);
      expect(res.statusCode).toBe(401);
    });

    it('requires token and recipient phone', async () => {
      verifySuperadmin.mockResolvedValue({ adminClient: { from: () => ({ insert: vi.fn() }) } });
      const res1 = makeRes();
      await handler({ method: 'POST', body: { action: 'ping', token: '' } }, res1);
      expect(res1.statusCode).toBe(400);

      const res2 = makeRes();
      await handler({ method: 'POST', body: { action: 'ping', token: 'valid-token', to: '' } }, res2);
      expect(res2.statusCode).toBe(400);
    });

    it('sends test message when valid', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      verifySuperadmin.mockResolvedValue({
        adminClient: { from: () => ({ insert: mockInsert }) }
      });
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: { success: true } });

      const res = makeRes();
      await handler({
        method: 'POST',
        body: {
          action: 'ping',
          token: 'token-123',
          to: '08123456789',
          senderName: 'Super Admin'
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(sendWatbizMessage).toHaveBeenCalledWith('token-123', {
        number: '628123456789',
        message: expect.stringContaining('Tes koneksi Watbiz')
      });
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('Action: register-webhook', () => {
    it('requires superadmin authentication', async () => {
      verifySuperadmin.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
      const res = makeRes();
      await handler({ method: 'POST', body: { action: 'register-webhook' } }, res);
      expect(res.statusCode).toBe(401);
    });

    it('requires token and webhookUrl', async () => {
      verifySuperadmin.mockResolvedValue({
        adminClient: {
          from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) })
        }
      });
      const res1 = makeRes();
      await handler({ method: 'POST', body: { action: 'register-webhook', token: '' } }, res1);
      expect(res1.statusCode).toBe(400);

      const res2 = makeRes();
      await handler({ method: 'POST', body: { action: 'register-webhook', token: 'token-123', webhookUrl: '' } }, res2);
      expect(res2.statusCode).toBe(400);
    });

    it('registers webhook URL via Watbiz API v2 and records log', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      verifySuperadmin.mockResolvedValue({
        adminClient: { from: () => ({ insert: mockInsert }) }
      });
      registerWatbizWebhook.mockResolvedValue({ ok: true, status: 200, body: { status: 'success' } });

      const res = makeRes();
      await handler({
        method: 'POST',
        body: {
          action: 'register-webhook',
          token: '51dad347-d267-4254-9858-3e3b19c76c53',
          webhookUrl: 'https://kasir-psi.vercel.app/api/watbiz'
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(registerWatbizWebhook).toHaveBeenCalledWith('51dad347-d267-4254-9858-3e3b19c76c53', 'https://kasir-psi.vercel.app/api/watbiz');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        phone_number: 'WEBHOOK_CONFIG',
        status: 'success'
      }));
    });
  });

  describe('Action: register-webhook (secret)', () => {
    afterEach(() => {
      delete process.env.WATBIZ_WEBHOOK_SECRET;
    });

    it('appends the webhook secret to the registered URL but never logs it', async () => {
      process.env.WATBIZ_WEBHOOK_SECRET = 'rahasia-123';
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      verifySuperadmin.mockResolvedValue({ adminClient: { from: () => ({ insert: mockInsert }) } });
      registerWatbizWebhook.mockResolvedValue({
        ok: true,
        status: 200,
        body: { status: 'success', webhook_url: 'https://app.example/api/watbiz?secret=rahasia-123' }
      });

      const res = makeRes();
      await handler({
        method: 'POST',
        body: { action: 'register-webhook', token: 'tok', webhookUrl: 'https://app.example/api/watbiz' }
      }, res);

      expect(registerWatbizWebhook).toHaveBeenCalledWith('tok', 'https://app.example/api/watbiz?secret=rahasia-123');
      const logged = mockInsert.mock.calls[0][0];
      expect(JSON.stringify(logged)).not.toContain('rahasia-123');
      expect(JSON.stringify(res.body)).not.toContain('rahasia-123');
    });

    it('hides the secret from get-webhook output', async () => {
      process.env.WATBIZ_WEBHOOK_SECRET = 'rahasia-123';
      verifyStaff.mockResolvedValue({
        adminClient: {
          from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { watbiz_token: 'tok' } }) }) }) })
        }
      });
      getWatbizProfile.mockResolvedValue({
        ok: true,
        status: 200,
        body: { data: { webhook_url: 'https://app.example/api/watbiz?secret=rahasia-123' } }
      });

      const res = makeRes();
      await handler({ method: 'POST', body: { action: 'get-webhook' } }, res);
      expect(res.body.webhookUrl).toBe('https://app.example/api/watbiz?secret=***');
      expect(JSON.stringify(res.body)).not.toContain('rahasia-123');
    });
  });

  describe('Action: get-webhook', () => {
    it('requires staff authentication', async () => {
      verifyStaff.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
      const res = makeRes();
      await handler({ method: 'POST', body: { action: 'get-webhook' } }, res);
      expect(res.statusCode).toBe(401);
    });

    it('returns registered webhook url from Watbiz profile', async () => {
      verifyStaff.mockResolvedValue({
        adminClient: {
          from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { watbiz_token: 'token-prof' } }) }) }) })
        }
      });
      getWatbizProfile.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          data: {
            webhook_url: 'https://kasir-psi.vercel.app/api/watbiz',
            name: 'Device-1',
            credit: 1500,
            whatsapp_credit: 988
          }
        }
      });

      const res = makeRes();
      await handler({ method: 'POST', body: { action: 'get-webhook' } }, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.webhookUrl).toBe('https://kasir-psi.vercel.app/api/watbiz');
      expect(res.body.credit).toBe(1500);
    });
  });

  describe('Action: send-invoice', () => {

    it('requires staff authentication', async () => {
      verifyStaff.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
      const res = makeRes();
      await handler({ method: 'POST', body: { action: 'send-invoice' } }, res);
      expect(res.statusCode).toBe(401);
    });

    it('validates transaction data and phone', async () => {
      verifyStaff.mockResolvedValue({ adminClient: { from: () => ({ insert: vi.fn() }) } });
      const res = makeRes();
      await handler({
        method: 'POST',
        body: { action: 'send-invoice', transaction: null }
      }, res);
      expect(res.statusCode).toBe(400);
    });

    it('sends official invoice markdown message', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      verifyStaff.mockResolvedValue({
        adminClient: { from: () => ({ insert: mockInsert }) },
        callerId: 'staff-1'
      });
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: {} });

      const res = makeRes();
      await handler({
        method: 'POST',
        body: {
          action: 'send-invoice',
          transaction: {
            id: 'trx-1',
            invoiceNumber: 'INV/2026/001',
            customerName: 'Budi Santoso',
            customerPhone: '081234567890',
            packageName: 'NET HOME 20 Mbps',
            price: 200000,
            amountPaid: 200000,
            change: 0,
            paymentMethod: 'Cash',
            date: '2026-09-23T10:00:00Z',
            cashierName: 'Admin Kasir'
          },
          customer: { name: 'Budi Santoso', phone: '081234567890', pppoe_id: 'budi_pppoe' },
          companyInfo: {
            name: 'PT Net Synergy Inovate',
            phone: '0811223344',
            watbizToken: 'token-abc'
          }
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(sendWatbizMessage).toHaveBeenCalledWith('token-abc', {
        number: '6281234567890',
        message: expect.stringContaining('*BUKTI PEMBAYARAN RESMI*')
      });
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('Action: send-reminder', () => {
    it('sends due reminder with isolir warning', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      verifyStaff.mockResolvedValue({
        adminClient: { from: () => ({ insert: mockInsert }) }
      });
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: {} });

      const res = makeRes();
      await handler({
        method: 'POST',
        body: {
          action: 'send-reminder',
          customer: {
            name: 'Ani Lestari',
            phone: '081987654321',
            package: 'NET HOME 10 Mbps',
            price: 150000,
            due_date: '25'
          },
          daysLeft: 2,
          companyInfo: {
            name: 'PT Net Synergy Inovate',
            watbizToken: 'token-abc'
          }
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(sendWatbizMessage).toHaveBeenCalledWith('token-abc', {
        number: '6281987654321',
        message: expect.stringMatching(/PEMUTUSAN KONEKSI \/ ISOLIR OTOMATIS/i)
      });
    });
  });

  describe('Action: send-reminders (batch)', () => {
    it('processes list of customers and reports total success and failed', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      verifyStaff.mockResolvedValue({
        adminClient: { from: () => ({ insert: mockInsert }) }
      });
      sendWatbizMessage
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, body: { error: 'Failed' } });

      const res = makeRes();
      await handler({
        method: 'POST',
        body: {
          action: 'send-reminders',
          customers: [
            { name: 'Cust 1', phone: '0811111111', due_date: 24 },
            { name: 'Cust 2', phone: '0822222222', due_date: 25 },
            { name: 'Cust 3', phone: '' } // skipped because no phone
          ],
          companyInfo: { watbizToken: 'token-batch' }
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.success).toBe(1);
      expect(res.body.failed).toBe(2);
    });
  });

  describe('Inbound Webhook (Auto-Payment & Auto-Konfirmasi)', () => {
    beforeEach(() => {
      process.env.WATBIZ_WEBHOOK_SECRET = 'test-secret';
    });

    afterEach(() => {
      delete process.env.WATBIZ_WEBHOOK_SECRET;
    });

    it('rejects webhook with missing or wrong secret and never touches the database', async () => {
      const res1 = makeRes();
      await handler({ method: 'POST', url: '/api/watbiz/webhook', body: { from: '6281234567890', type: 'image', media_url: 'https://x/y.jpg' } }, res1);
      expect(res1.statusCode).toBe(401);

      const res2 = makeRes();
      await handler({ method: 'POST', url: '/api/watbiz/webhook?secret=salah', body: { from: '6281234567890', type: 'image', media_url: 'https://x/y.jpg' } }, res2);
      expect(res2.statusCode).toBe(401);

      expect(getServiceClient).not.toHaveBeenCalled();
    });

    it('accepts secret via x-webhook-secret header', async () => {
      getServiceClient.mockReturnValue({ from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }) });
      const res = makeRes();
      await handler({ method: 'POST', url: '/api/watbiz/webhook', headers: { 'x-webhook-secret': 'test-secret' }, body: { text: 'Halo' } }, res);
      expect(res.statusCode).toBe(200);
    });

    it('fails closed with 503 when WATBIZ_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.WATBIZ_WEBHOOK_SECRET;
      const res = makeRes();
      await handler({ method: 'POST', url: '/api/watbiz/webhook?secret=apa-saja', body: { from: '6281234567890', type: 'image' } }, res);
      expect(res.statusCode).toBe(503);
      expect(getServiceClient).not.toHaveBeenCalled();
    });
    it('skips when no valid phone number in payload', async () => {
      getServiceClient.mockReturnValue({
        from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) })
      });
      const res = makeRes();
      await handler({
        method: 'POST',
        url: '/api/watbiz/webhook?secret=test-secret',
        body: { text: 'Halo' }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/No valid sender phone/i);
    });

    it('demands photo proof and does NOT pay when customer sends text claiming payment without image', async () => {
      const mockCustomer = {
        id: 'cust-101',
        custid: 'CUST-101',
        name: 'Ahmad Fauzi',
        phone: '081234567890',
        package: 'NET HOME 20 Mbps',
        price: 200000,
        due_date: 25,
        status: 'isolir'
      };

      const mockInsertTrx = vi.fn();
      const mockUpdateCust = vi.fn();
      const mockInsertLog = vi.fn().mockResolvedValue({ error: null });

      const mockAdminClient = {
        from: (table) => {
          if (table === 'company_settings') {
            return {
              select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { watbiz_token: 'token-bot', watbiz_enabled: true } }) }) })
            };
          }
          if (table === 'watbiz_logs') {
            return { insert: mockInsertLog };
          }
          if (table === 'customers') {
            return {
              select: () => ({
                ilike: () => Promise.resolve({ data: [mockCustomer], error: null })
              }),
              update: mockUpdateCust
            };
          }
          if (table === 'transactions') {
            return { insert: mockInsertTrx };
          }
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        }
      };

      getServiceClient.mockReturnValue(mockAdminClient);
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: {} });

      const res = makeRes();
      await handler({
        method: 'POST',
        url: '/api/watbiz/webhook?secret=test-secret',
        body: {
          from: '6281234567890',
          text: 'Halo admin kasir, saya sudah transfer tagihan internet'
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('proof_photo_required');
      expect(res.body.customer).toBe('Ahmad Fauzi');

      // Memastikan transaksi TIDAK dibuat dan status pelanggan TIDAK berubah
      expect(mockInsertTrx).not.toHaveBeenCalled();
      expect(mockUpdateCust).not.toHaveBeenCalled();

      // Memastikan pesan minta foto bukti transfer dikirim via WhatsApp
      expect(sendWatbizMessage).toHaveBeenCalledWith('token-bot', {
        number: '6281234567890',
        message: expect.stringMatching(/FOTO STRUK TRANSFER/i)
      });
    });

    it('automatically processes payment when registered customer sends payment proof image', async () => {
      const mockCustomer = {
        id: 'cust-101',
        custid: 'CUST-101',
        name: 'Ahmad Fauzi',
        phone: '081234567890',
        package: 'NET HOME 20 Mbps',
        price: 200000,
        due_date: 25,
        status: 'isolir'
      };

      const mockInsertTrx = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateCust = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockInsertProof = vi.fn().mockResolvedValue({ error: null });
      const mockInsertLog = vi.fn().mockResolvedValue({ error: null });

      const mockAdminClient = {
        from: (table) => {
          if (table === 'company_settings') {
            return {
              select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { watbiz_token: 'token-bot', watbiz_enabled: true } }) }) })
            };
          }
          if (table === 'watbiz_logs') {
            return { insert: mockInsertLog };
          }
          if (table === 'customers') {
            return {
              select: () => ({
                ilike: () => Promise.resolve({ data: [mockCustomer], error: null })
              }),
              update: mockUpdateCust
            };
          }
          if (table === 'transactions') {
            return {
              select: () => ({
                eq: () => ({
                  gte: () => ({
                    eq: () => Promise.resolve({ data: [], error: null }) // belum bayar bulan ini
                  })
                })
              }),
              insert: mockInsertTrx
            };
          }
          if (table === 'runsnet_proofs') {
            return { insert: mockInsertProof };
          }
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        }
      };

      getServiceClient.mockReturnValue(mockAdminClient);
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: {} });

      const res = makeRes();
      await handler({
        method: 'POST',
        url: '/api/watbiz/webhook?secret=test-secret',
        body: {
          from: '6281234567890',
          type: 'image',
          media_url: 'https://example.com/bukti-transfer.jpg',
          caption: 'Sudah bayar ya kak'
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('auto_payment_success');
      expect(res.body.customer).toBe('Ahmad Fauzi');

      // Memastikan transaksi tersimpan dengan metode Transfer WA dan kasir bot
      expect(mockInsertTrx).toHaveBeenCalledWith([expect.objectContaining({
        status: 'LUNAS',
        payment_method: 'Transfer WA',
        cashier_name: 'WhatsApp Bot (Auto)'
      })]);

      // Memastikan bukti foto tersimpan ke runsnet_proofs pada kolom `image`
      expect(mockInsertProof).toHaveBeenCalledWith(expect.objectContaining({
        image: 'https://example.com/bukti-transfer.jpg',
        uploaded_by_name: 'WhatsApp Pelanggan'
      }));

      // Memastikan status pelanggan diperbarui menjadi 'aktif'
      expect(mockUpdateCust).toHaveBeenCalledWith(expect.objectContaining({ status: 'aktif' }));

      // Memastikan sinkronisasi Runsnet dipicu
      expect(syncPayment).toHaveBeenCalled();

      // Memastikan balasan konfirmasi resmi terkirim via WhatsApp
      expect(sendWatbizMessage).toHaveBeenCalledWith('token-bot', {
        number: '6281234567890',
        message: expect.stringMatching(/PEMBAYARAN OTOMATIS DIVERIFIKASI/i)
      });
    });

    it('does NOT auto-pay when sender (@lid) only matches a customer by push_name; logs for manual review', async () => {
      const mockCustomer = {
        id: 'cust-202',
        custid: 'CUST-202',
        name: 'JEFRI NET SYNERGY',
        phone: '085169690961',
        package: 'NET HOME 20 Mbps',
        price: 250000,
        due_date: 20,
        status: 'isolir'
      };

      const mockInsertTrx = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateCust = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockInsertProof = vi.fn().mockResolvedValue({ error: null });
      const mockInsertLog = vi.fn().mockResolvedValue({ error: null });

      const mockAdminClient = {
        from: (table) => {
          if (table === 'company_settings') {
            return {
              select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { watbiz_token: 'token-bot', watbiz_enabled: true } }) }) })
            };
          }
          if (table === 'watbiz_logs') {
            return { insert: mockInsertLog };
          }
          if (table === 'customers') {
            return {
              select: () => Promise.resolve({ data: [mockCustomer], error: null }),
              update: mockUpdateCust
            };
          }
          if (table === 'transactions') {
            return {
              select: () => ({
                eq: () => ({
                  gte: () => ({
                    eq: () => Promise.resolve({ data: [], error: null })
                  })
                })
              }),
              insert: mockInsertTrx
            };
          }
          if (table === 'runsnet_proofs') {
            return { insert: mockInsertProof };
          }
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        }
      };

      getServiceClient.mockReturnValue(mockAdminClient);
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: {} });

      const res = makeRes();
      await handler({
        method: 'POST',
        url: '/api/watbiz/webhook?secret=test-secret',
        body: {
          device: '9884_IQOO_Z10',
          from: '156191435051118@lid',
          push_name: 'Jefri Afriansyah Maulana',
          type: 'image',
          body: '',
          message_id: 'AC532A564D57AA75156A4F5CBCFD6B07',
          timestamp: 1790227104
        }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('manual_review_required');
      expect(res.body.customer).toBe('JEFRI NET SYNERGY');

      // Tidak ada transaksi, tidak ada perubahan status pelanggan, tidak ada balasan WA ke nomor tebakan
      expect(mockInsertTrx).not.toHaveBeenCalled();
      expect(mockUpdateCust).not.toHaveBeenCalled();
      expect(mockInsertProof).not.toHaveBeenCalled();
      expect(syncPayment).not.toHaveBeenCalled();
      expect(sendWatbizMessage).not.toHaveBeenCalled();

      // Admin melihat entri "perlu verifikasi manual" di log
      expect(mockInsertLog).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'inbound_manual_review',
        status: 'manual_review_required'
      }));
    });
  });

});
