import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadVerifiedProfile } from '../authProfile';

const makeClient = ({ profile, selectError = null, updateError = null }) => {
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: updateError })) }));
  const client = {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: selectError }) }) }),
      update,
    })),
  };
  return { client, update };
};

const session = { user: { id: 'u1' } };

describe('loadVerifiedProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an error when the user has no admin_profiles row', async () => {
    const { client } = makeClient({ profile: null });
    const result = await loadVerifiedProfile(client, session);
    expect(result.error).toMatch(/belum terdaftar/);
  });

  it('lets a superadmin through without touching device data', async () => {
    const { client, update } = makeClient({ profile: { id: 'u1', role: 'superadmin', device_id: null } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.profile.role).toBe('superadmin');
    expect(update).not.toHaveBeenCalled();
  });

  it('binds an unbound admin to the current device', async () => {
    const { client, update } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: null } });
    const result = await loadVerifiedProfile(client, session);
    expect(update).toHaveBeenCalled();
    expect(result.profile.device_id).toBe(localStorage.getItem('kasir_device_id'));
  });

  it('accepts an admin on the bound device', async () => {
    localStorage.setItem('kasir_device_id', 'dev-A');
    const { client } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: 'dev-A' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.profile.role).toBe('admin');
    expect(result.error).toBeUndefined();
  });

  it('rejects an admin on a different device', async () => {
    localStorage.setItem('kasir_device_id', 'dev-B');
    const { client } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: 'dev-A' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.error).toMatch(/terkunci ke device lain/);
  });
});
