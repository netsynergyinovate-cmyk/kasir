import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadVerifiedProfile, fetchApproxLocation } from '../authProfile';

const makeClient = ({ profile, profileAfterClaim, selectError = null, rpcError = null, claimResult = false, claimError = null }) => {
  let selectCalls = 0;
  const rpc = vi.fn(async (name) => (
    name === 'claim_invite' ? { data: claimResult, error: claimError } : { error: rpcError }
  ));
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            selectCalls += 1;
            const data = selectCalls > 1 && profileAfterClaim !== undefined ? profileAfterClaim : profile;
            return { data, error: selectError };
          },
        }),
      }),
    })),
    rpc,
  };
  return { client, rpc };
};

const session = { user: { id: 'u1' } };

const stubGeoOk = () =>
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ ip: '1.2.3.4', city: 'Jakarta', country_name: 'Indonesia' }),
  })));

describe('loadVerifiedProfile', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    stubGeoOk();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an error when the user has no admin_profiles row', async () => {
    const { client, rpc } = makeClient({ profile: null });
    const result = await loadVerifiedProfile(client, session);
    expect(result.error).toMatch(/belum terdaftar/);
    expect(rpc).toHaveBeenCalledWith('claim_invite');
    expect(rpc).not.toHaveBeenCalledWith('record_login', expect.anything());
  });

  it('turns a pending invite into an admin profile on first login', async () => {
    const { client, rpc } = makeClient({
      profile: null,
      claimResult: true,
      profileAfterClaim: { id: 'u1', role: 'admin', device_id: null },
    });
    const result = await loadVerifiedProfile(client, session);
    expect(rpc).toHaveBeenCalledWith('claim_invite');
    expect(result.error).toBeUndefined();
    expect(result.profile.role).toBe('admin');
    // Device TIDAK auto-terkunci lagi — masih null sampai superadmin mengunci manual.
    expect(result.profile.device_id).toBeNull();
  });

  it('treats a failing claim_invite call as not registered', async () => {
    const { client } = makeClient({ profile: null, claimError: { message: 'boom' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.error).toMatch(/belum terdaftar/);
  });

  it('does not call claim_invite when the profile already exists', async () => {
    const { client, rpc } = makeClient({ profile: { id: 'u1', role: 'superadmin' } });
    await loadVerifiedProfile(client, session);
    expect(rpc).not.toHaveBeenCalledWith('claim_invite');
  });

  it('records the login for a superadmin with device, ip and location', async () => {
    const { client, rpc } = makeClient({ profile: { id: 'u1', role: 'superadmin', device_id: null } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.profile.role).toBe('superadmin');
    expect(rpc).toHaveBeenCalledWith('record_login', expect.objectContaining({
      p_ip: '1.2.3.4',
      p_location: 'Jakarta, Indonesia',
    }));
  });

  it('records the login only once per browser tab session', async () => {
    const { client, rpc } = makeClient({ profile: { id: 'u1', role: 'superadmin', device_id: null } });
    await loadVerifiedProfile(client, session);
    await loadVerifiedProfile(client, session);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('still lets a superadmin in when recording the login fails', async () => {
    const { client } = makeClient({ profile: { id: 'u1', role: 'superadmin' }, rpcError: { message: 'boom' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.profile.role).toBe('superadmin');
    expect(result.error).toBeUndefined();
  });

  it('still records the login when the geo lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { client, rpc } = makeClient({ profile: { id: 'u1', role: 'superadmin' } });
    await loadVerifiedProfile(client, session);
    expect(rpc).toHaveBeenCalledWith('record_login', expect.objectContaining({ p_ip: null, p_location: null }));
  });

  it('records the login for an unbound admin without auto-locking the device', async () => {
    const { client, rpc } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: null } });
    const result = await loadVerifiedProfile(client, session);
    const deviceId = localStorage.getItem('kasir_device_id');
    expect(rpc).toHaveBeenCalledWith('record_login', expect.objectContaining({ p_device_id: deviceId }));
    expect(result.profile.device_id).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('still lets an unbound admin in when recording the login fails', async () => {
    const { client } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: null }, rpcError: { message: 'boom' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.error).toBeUndefined();
    expect(result.profile.role).toBe('admin');
  });

  it('accepts an admin on the bound device', async () => {
    localStorage.setItem('kasir_device_id', 'dev-A');
    const { client } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: 'dev-A' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.profile.role).toBe('admin');
    expect(result.error).toBeUndefined();
  });

  it('rejects an admin on a different device without recording a login', async () => {
    localStorage.setItem('kasir_device_id', 'dev-B');
    const { client, rpc } = makeClient({ profile: { id: 'u1', role: 'admin', device_id: 'dev-A' } });
    const result = await loadVerifiedProfile(client, session);
    expect(result.error).toMatch(/terkunci ke device lain/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('fetchApproxLocation', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the next provider when the first one fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ip: '5.6.7.8', city: 'Bandung', country: 'Indonesia' }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchApproxLocation();
    expect(result).toEqual({ ip: '5.6.7.8', location: 'Bandung, Indonesia' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches a successful lookup for the tab session', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ip: '1.1.1.1', city: 'Jakarta', country: 'Indonesia' }) }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchApproxLocation();
    await fetchApproxLocation();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns nulls when every provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await fetchApproxLocation()).toEqual({ ip: null, location: null });
  });
});
