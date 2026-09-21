import { describe, it, expect } from 'vitest';
import { canDeleteAdmin } from '../adminAccounts';

const admin = (over) => ({ id: 'admin-1', role: 'admin', ...over });

describe('canDeleteAdmin', () => {
  it('allows deleting an admin account', () => {
    expect(canDeleteAdmin({ target: admin(), callerId: 'super-1' })).toEqual({ ok: true });
  });

  it('refuses to delete a superadmin account (only role admin can be removed this way)', () => {
    const result = canDeleteAdmin({ target: admin({ role: 'superadmin' }), callerId: 'super-1' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/superadmin/i);
  });

  it('refuses to let an account delete itself', () => {
    const result = canDeleteAdmin({ target: admin({ id: 'super-1' }), callerId: 'super-1' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sendiri/i);
  });

  it('refuses when there is no target', () => {
    const result = canDeleteAdmin({ target: null, callerId: 'super-1' });
    expect(result.ok).toBe(false);
  });
});
