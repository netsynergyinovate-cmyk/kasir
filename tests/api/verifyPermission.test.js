import { describe, it, expect, vi, beforeEach } from 'vitest';

const profile = { current: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
}));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  getServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile.current, error: null }) }) }) }),
  }),
}));

import { verifyPermission } from '../../api/_lib/verifySuperadmin.js';

const req = { headers: { authorization: 'Bearer token' } };

describe('verifyPermission', () => {
  beforeEach(() => { profile.current = null; });

  it('lets superadmin through regardless of permissions', async () => {
    profile.current = { role: 'superadmin', allowed_paths: null };
    expect((await verifyPermission(req, 'history.cancel')).error).toBeUndefined();
  });

  it('lets an admin through only when the permission was granted', async () => {
    profile.current = { role: 'admin', allowed_paths: { paths: ['/pos'], permissions: ['history.cancel'] } };
    expect((await verifyPermission(req, 'history.cancel')).error).toBeUndefined();
    expect((await verifyPermission(req, 'runsnet.sync_customers')).error.status).toBe(403);
  });

  it('rejects an admin whose access was never configured', async () => {
    profile.current = { role: 'admin', allowed_paths: null };
    expect((await verifyPermission(req, 'history.cancel')).error.status).toBe(403);
  });
});
