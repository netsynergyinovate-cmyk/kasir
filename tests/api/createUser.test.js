import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/verifySuperadmin.js', () => ({ verifySuperadmin: vi.fn() }));

import { verifySuperadmin } from '../../api/_lib/verifySuperadmin.js';
import handler from '../../api/admin/create-user.js';

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const makeAdminClient = ({ createError = null, insertError = null } = {}) => {
  const deleteUser = vi.fn(async () => ({}));
  const createUser = vi.fn(async () => ({
    data: createError ? null : { user: { id: 'new-id' } },
    error: createError,
  }));
  const insert = vi.fn(async () => ({ error: insertError }));
  return {
    client: { auth: { admin: { createUser, deleteUser } }, from: vi.fn(() => ({ insert })) },
    createUser, deleteUser, insert,
  };
};

describe('POST /api/admin/create-user', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('passes through the auth error from verifySuperadmin', async () => {
    verifySuperadmin.mockResolvedValue({ error: { status: 403, message: 'Hanya superadmin' } });
    const res = makeRes();
    await handler({ method: 'POST', body: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Hanya superadmin');
  });

  it('returns a readable json error when the server is misconfigured', async () => {
    verifySuperadmin.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set'));
    const res = makeRes();
    await handler({ method: 'POST', body: { email: 'a@b.com', fullName: 'X' } }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('requires email and name but not a password', async () => {
    const { client } = makeAdminClient();
    verifySuperadmin.mockResolvedValue({ adminClient: client });
    const res = makeRes();
    await handler({ method: 'POST', body: { email: 'a@b.com' } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('creates the auth user with a random password and an admin profile', async () => {
    const { client, createUser, insert } = makeAdminClient();
    verifySuperadmin.mockResolvedValue({ adminClient: client });
    const res = makeRes();
    await handler({ method: 'POST', body: { email: 'budi@gmail.com', fullName: 'Budi' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, userId: 'new-id' });
    const args = createUser.mock.calls[0][0];
    expect(args.email).toBe('budi@gmail.com');
    expect(args.email_confirm).toBe(true);
    expect(args.password.length).toBeGreaterThanOrEqual(32);
    expect(insert).toHaveBeenCalledWith({ id: 'new-id', full_name: 'Budi', email: 'budi@gmail.com', role: 'admin' });
  });

  it('rolls back the auth user when the profile insert fails', async () => {
    const { client, deleteUser } = makeAdminClient({ insertError: { message: 'db down' } });
    verifySuperadmin.mockResolvedValue({ adminClient: client });
    const res = makeRes();
    await handler({ method: 'POST', body: { email: 'budi@gmail.com', fullName: 'Budi' } }, res);
    expect(res.statusCode).toBe(400);
    expect(deleteUser).toHaveBeenCalledWith('new-id');
  });
});
