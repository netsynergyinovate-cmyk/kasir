import { describe, it, expect } from 'vitest';
import { isPathAllowedForRole, ADMIN_ALLOWED_PATHS, ADMIN_DEFAULT_PATH } from '../permissions';

describe('isPathAllowedForRole', () => {
  it('allows superadmin on any path', () => {
    expect(isPathAllowedForRole('superadmin', '/instansi')).toBe(true);
    expect(isPathAllowedForRole('superadmin', '/aktivitas')).toBe(true);
    expect(isPathAllowedForRole('superadmin', '/pos')).toBe(true);
  });

  it('allows admin only on the allow-listed paths', () => {
    ADMIN_ALLOWED_PATHS.forEach((path) => {
      expect(isPathAllowedForRole('admin', path)).toBe(true);
    });
  });

  it('allows admin on the dashboard', () => {
    expect(isPathAllowedForRole('admin', '/')).toBe(true);
  });

  it('allows admin to view history and activity', () => {
    expect(isPathAllowedForRole('admin', '/history')).toBe(true);
    expect(isPathAllowedForRole('admin', '/aktivitas')).toBe(true);
  });

  it('blocks admin on paths outside the allow-list', () => {
    expect(isPathAllowedForRole('admin', '/instansi')).toBe(false);
  });

  it('exposes /pos as the admin default landing path', () => {
    expect(ADMIN_DEFAULT_PATH).toBe('/pos');
  });
});
