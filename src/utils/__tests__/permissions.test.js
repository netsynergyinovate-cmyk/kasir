import { describe, it, expect } from 'vitest';
import { isPathAllowedForRole, visibleMenusForRole, ADMIN_ALLOWED_PATHS, ADMIN_DEFAULT_PATH, CONFIGURABLE_ADMIN_MENUS } from '../permissions';

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

  it('does not get the visit route page (admin sees the route on the dashboard instead)', () => {
    expect(isPathAllowedForRole('admin', '/rute')).toBe(false);
    expect(isPathAllowedForRole('superadmin', '/rute')).toBe(true);
  });

  it('blocks admin on paths outside the allow-list', () => {
    expect(isPathAllowedForRole('admin', '/instansi')).toBe(false);
  });

  it('exposes /pos as the admin default landing path', () => {
    expect(ADMIN_DEFAULT_PATH).toBe('/pos');
  });

  it('falls back to the default allow-list when a specific admin has no custom menu set (allowedPaths null)', () => {
    expect(isPathAllowedForRole('admin', '/customers', null)).toBe(true);
    expect(isPathAllowedForRole('admin', '/instansi', null)).toBe(false);
  });

  it('restricts a specific admin to exactly their configured menus once superadmin has set some', () => {
    const onlyPos = ['/pos'];
    expect(isPathAllowedForRole('admin', '/pos', onlyPos)).toBe(true);
    expect(isPathAllowedForRole('admin', '/customers', onlyPos)).toBe(false);
    expect(isPathAllowedForRole('admin', '/history', onlyPos)).toBe(false);
  });

  it('lets superadmin configure an admin down to zero menus (locked out, until superadmin fixes it)', () => {
    expect(isPathAllowedForRole('admin', '/pos', [])).toBe(false);
  });

  it('is never affected by allowedPaths for superadmin', () => {
    expect(isPathAllowedForRole('superadmin', '/pos', [])).toBe(true);
  });
});

describe('visibleMenusForRole', () => {
  it('shows every configurable menu to superadmin, ignoring allowedPaths', () => {
    expect(visibleMenusForRole('superadmin', ['/pos'])).toEqual(CONFIGURABLE_ADMIN_MENUS);
  });

  it('shows the default menus to an admin with no custom set', () => {
    expect(visibleMenusForRole('admin', null).map((m) => m.path)).toEqual(ADMIN_ALLOWED_PATHS);
  });

  it('shows only the configured menus, in CONFIGURABLE_ADMIN_MENUS order, for a restricted admin', () => {
    const menus = visibleMenusForRole('admin', ['/history', '/pos']);
    expect(menus.map((m) => m.path)).toEqual(['/pos', '/history']);
  });
});
