import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/verifySuperadmin.js', () => ({ verifySuperadmin: vi.fn() }));
vi.mock('../../api/_lib/runsnetClient.js', () => ({ pingRunsnet: vi.fn() }));

import { verifySuperadmin } from '../../api/_lib/verifySuperadmin.js';
import { pingRunsnet } from '../../api/_lib/runsnetClient.js';
import handler from '../../api/runsnet/ping.js';

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('POST /api/runsnet/ping', () => {
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
    expect(pingRunsnet).not.toHaveBeenCalled();
  });

  it('reports success when login works', async () => {
    verifySuperadmin.mockResolvedValue({ adminClient: {} });
    pingRunsnet.mockResolvedValue({ ok: true });
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('reports the failure reason when login fails', async () => {
    verifySuperadmin.mockResolvedValue({ adminClient: {} });
    pingRunsnet.mockResolvedValue({ ok: false, message: 'RUNSNET_USERNAME / RUNSNET_PASSWORD belum di-set.' });
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/belum di-set/);
  });
});
