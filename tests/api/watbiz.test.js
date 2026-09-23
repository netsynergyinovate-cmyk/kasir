import { describe, it, expect, vi, beforeEach } from 'vitest';

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
}));

vi.mock('../../api/_lib/paymentSync.js', () => ({
  syncPayment: vi.fn(),
}));

import { verifySuperadmin, verifyStaff } from '../../api/_lib/verifySuperadmin.js';
import { getServiceClient } from '../../api/_lib/supabaseAdmin.js';
import { sendWatbizMessage } from '../../api/_lib/watbizClient.js';
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
    it('skips when no valid phone number in payload', async () => {
      getServiceClient.mockReturnValue({});
      const res = makeRes();
      await handler({
        method: 'POST',
        url: '/api/watbiz/webhook',
        body: { text: 'Halo' }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/No valid sender phone/i);
    });

    it('automatically processes payment when registered customer sends payment proof image or text', async () => {
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

      const mockInsertTrx = vi.fn().mockReturnValue({
        select: () => ({ single: () => Promise.resolve({ data: { id: 'trx-auto-1', price: 200000 }, error: null }) })
      });
      const mockUpdateCust = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
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
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        }
      };

      getServiceClient.mockReturnValue(mockAdminClient);
      sendWatbizMessage.mockResolvedValue({ ok: true, status: 200, body: {} });

      const res = makeRes();
      await handler({
        method: 'POST',
        url: '/api/watbiz/webhook',
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
  });
});
