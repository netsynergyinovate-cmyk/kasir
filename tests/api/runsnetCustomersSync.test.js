import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/verifySuperadmin.js', () => ({ verifySuperadmin: vi.fn() }));
vi.mock('../../api/_lib/runsnetClient.js', () => ({ ensureSession: vi.fn(), fetchAllCustomers: vi.fn() }));

import { verifySuperadmin } from '../../api/_lib/verifySuperadmin.js';
import { ensureSession, fetchAllCustomers } from '../../api/_lib/runsnetClient.js';
import handler from '../../api/runsnet/customers.js';

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const runsnetCustomer = (custid, name) => ({ custid, name, package: 'HOME SERVER', type: 'Postpaid', status: 'aktif' });

describe('POST /api/runsnet/customers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('requires a valid superadmin token', async () => {
    verifySuperadmin.mockResolvedValue({ error: { status: 401, message: 'Token tidak valid.' } });
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body: { custids: ['C1'] } }, res);
    expect(res.statusCode).toBe(401);
    expect(fetchAllCustomers).not.toHaveBeenCalled();
  });

  it('refuses to import when no custids are selected (prevents an accidental full pull)', async () => {
    verifySuperadmin.mockResolvedValue({ adminClient: {} });
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(fetchAllCustomers).not.toHaveBeenCalled();

    const res2 = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { custids: [] } }, res2);
    expect(res2.statusCode).toBe(400);
  });

  it('imports ONLY the selected custids, even when Runsnet returns more customers than that', async () => {
    const existingRow = { id: 'CUST-OLD', custid: 'C2', nickname: 'Bos', address: 'Jl. Lama', phone: '0812' };
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null })        // C1: pelanggan baru
      .mockResolvedValueOnce({ data: existingRow }); // C2: sudah ada
    const upsert = vi.fn(async () => ({ error: null }));
    const adminClient = {
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }), upsert })),
    };
    verifySuperadmin.mockResolvedValue({ adminClient });
    ensureSession.mockResolvedValue('cookie123');
    // Runsnet returns 3 customers, tapi superadmin cuma memilih C1 dan C2.
    fetchAllCustomers.mockResolvedValue([
      runsnetCustomer('C1', 'Baru'),
      runsnetCustomer('C2', 'Sudah Ada'),
      runsnetCustomer('C3', 'Tidak Dipilih'),
    ]);

    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { custids: ['C1', 'C2'] } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, total: 2, created: 1, updated: 1 });
    expect(upsert).toHaveBeenCalledTimes(2);
    const updateCall = upsert.mock.calls[1][0];
    expect(updateCall.id).toBe('CUST-OLD');
    expect(updateCall.address).toBe('Jl. Lama');
  });

  it('reports a readable error when Runsnet is unreachable', async () => {
    verifySuperadmin.mockResolvedValue({ adminClient: {} });
    ensureSession.mockRejectedValue(new Error('Login Runsnet gagal'));
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { custids: ['C1'] } }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Login Runsnet gagal/);
  });
});
