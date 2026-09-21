import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/verifySuperadmin.js', () => ({ verifySuperadmin: vi.fn() }));
vi.mock('../../api/_lib/runsnetClient.js', () => ({ ensureSession: vi.fn(), fetchAllCustomers: vi.fn() }));

import { verifySuperadmin } from '../../api/_lib/verifySuperadmin.js';
import { ensureSession, fetchAllCustomers } from '../../api/_lib/runsnetClient.js';
import handler from '../../api/runsnet/customers-list.js';

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('POST /api/runsnet/customers-list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('requires a valid superadmin token', async () => {
    verifySuperadmin.mockResolvedValue({ error: { status: 401, message: 'Token tidak valid.' } });
    const res = makeRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(fetchAllCustomers).not.toHaveBeenCalled();
  });

  it('returns the Runsnet customer list without writing anything', async () => {
    const adminClient = { from: vi.fn() };
    verifySuperadmin.mockResolvedValue({ adminClient });
    ensureSession.mockResolvedValue('cookie123');
    fetchAllCustomers.mockResolvedValue([{ custid: 'C1', name: 'Budi', package: 'X', type: 'Postpaid', status: 'aktif' }]);

    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ customers: [{ custid: 'C1', name: 'Budi', package: 'X', type: 'Postpaid', status: 'aktif' }] });
    expect(adminClient.from).not.toHaveBeenCalled(); // tidak menyentuh tabel apa pun
  });
});
