import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/verifySuperadmin.js', () => ({ verifyStaff: vi.fn() }));
vi.mock('../../api/_lib/runsnetClient.js', () => ({
  getRunsnetSession: vi.fn(),
  fetchInvoiceStatuses: vi.fn(),
  isRunsnetConfigured: vi.fn(() => true),
}));

import { verifyStaff } from '../../api/_lib/verifySuperadmin.js';
import { getRunsnetSession, fetchInvoiceStatuses } from '../../api/_lib/runsnetClient.js';
import handler from '../../api/runsnet/invoice-status.js';

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('POST /api/runsnet/invoice-status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('requires a valid staff token', async () => {
    verifyStaff.mockResolvedValue({ error: { status: 401, message: 'Token tidak valid.' } });
    const res = makeRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(getRunsnetSession).not.toHaveBeenCalled();
  });

  it('logs a stage "check" row per invoice, so the checking itself is visible in the Runsnet log', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const adminClient = { from: vi.fn(() => ({ upsert })) };
    verifyStaff.mockResolvedValue({ adminClient });
    getRunsnetSession.mockResolvedValue({ cookie: 'c', menu: {} });
    fetchInvoiceStatuses.mockResolvedValue({ INVRT1: 'PAID', INVRT2: 'PENDING' });

    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { codes: ['INVRT1', 'INVRT2'] } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.statuses).toEqual({ INVRT1: 'PAID', INVRT2: 'PENDING' });
    expect(adminClient.from).toHaveBeenCalledWith('runsnet_sync_log');
    expect(upsert).toHaveBeenCalledTimes(1);
    const rows = upsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ transaction_id: 'check:INVRT1', stage: 'check', runsnet_ref: 'INVRT1', status: 'success' });
    expect(rows[1]).toMatchObject({ transaction_id: 'check:INVRT2', stage: 'check', runsnet_ref: 'INVRT2', status: 'success' });
  });

  it('does not write to the log when there are no codes to check', async () => {
    const adminClient = { from: vi.fn() };
    verifyStaff.mockResolvedValue({ adminClient });
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { codes: [] } }, res);
    expect(res.statusCode).toBe(200);
    expect(adminClient.from).not.toHaveBeenCalled();
  });
});
