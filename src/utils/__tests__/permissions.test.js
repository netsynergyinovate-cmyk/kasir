import { describe, it, expect } from 'vitest';
import {
  isPathAllowedForRole, visibleMenusForRole,
  ADMIN_ALLOWED_PATHS, ADMIN_DEFAULT_PATH, CONFIGURABLE_ADMIN_MENUS,
  PERMISSION_MODULES, ALL_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS,
  normalizeAdminAccess, hasPermission
} from '../permissions';

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

  it('allows paths with query parameters and hash anchors when base path is allowed', () => {
    expect(isPathAllowedForRole('admin', '/customers?tab=isolir')).toBe(true);
    expect(isPathAllowedForRole('admin', '/history?tab=kasbon&month=5#top')).toBe(true);
    expect(isPathAllowedForRole('admin', '/instansi?tab=clients')).toBe(false);
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

  it('allows path when contained in object paths', () => {
    const access = { paths: ['/pos', '/history'], permissions: [] };
    expect(isPathAllowedForRole('admin', '/pos', access)).toBe(true);
    expect(isPathAllowedForRole('admin', '/history', access)).toBe(true);
    expect(isPathAllowedForRole('admin', '/customers', access)).toBe(false);
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

describe('PERMISSION_MODULES', () => {
  it('defines 8 permission modules', () => {
    expect(PERMISSION_MODULES).toHaveLength(8);
    const moduleIds = PERMISSION_MODULES.map((m) => m.id);
    expect(moduleIds).toEqual(['pos', 'customers', 'history', 'rute', 'whatsapp', 'finance', 'settings', 'runsnet']);
  });

  it('ALL_PERMISSIONS covers every permission across all modules', () => {
    const fromModules = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.id));
    expect(ALL_PERMISSIONS).toEqual(fromModules);
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(25);
  });
});

describe('normalizeAdminAccess', () => {
  it('normalizes null/undefined to default paths and permissions', () => {
    const normalized = normalizeAdminAccess(null);
    expect(normalized.paths).toEqual(ADMIN_ALLOWED_PATHS);
    expect(normalized.permissions).toEqual(DEFAULT_ADMIN_PERMISSIONS);
    expect(normalized.map_icon).toBeNull();
    expect(normalized.commissions).toEqual([]);
  });

  it('normalizes legacy array format to structured object', () => {
    const legacy = ['/pos', '/customers'];
    const normalized = normalizeAdminAccess(legacy);
    expect(normalized.paths).toEqual(legacy);
    expect(normalized.permissions).toContain('pos.view');
    expect(normalized.permissions).toContain('customers.view');
    expect(normalized.permissions).not.toContain('history.view');
  });

  it('preserves existing object format and custom fields', () => {
    const custom = {
      paths: ['/pos'],
      permissions: ['pos.view', 'pos.retail'],
      map_icon: { type: 'motor', color: '#10b981', label: 'RD' },
      commissions: [{ id: 'comm-1', amount: 50000 }]
    };
    const normalized = normalizeAdminAccess(custom);
    expect(normalized.paths).toEqual(['/pos']);
    expect(normalized.permissions).toEqual(['pos.view', 'pos.retail']);
    expect(normalized.map_icon.type).toBe('motor');
    expect(normalized.commissions).toHaveLength(1);
  });

  it('keeps Superadmin bonuses, defaulting to an empty list in every format', () => {
    const bonuses = [{ id: 'b1', amount: 50000, period: '2026-09' }];
    expect(normalizeAdminAccess({ paths: ['/pos'], bonuses }).bonuses).toEqual(bonuses);
    expect(normalizeAdminAccess({ paths: ['/pos'] }).bonuses).toEqual([]);
    expect(normalizeAdminAccess(null).bonuses).toEqual([]);
    expect(normalizeAdminAccess(['/pos']).bonuses).toEqual([]);
  });
});

describe('hasPermission', () => {
  it('allows superadmin any permission', () => {
    expect(hasPermission('superadmin', 'customers.delete')).toBe(true);
    expect(hasPermission('superadmin', 'finance.view_omset')).toBe(true);
    expect(hasPermission('superadmin', 'settings.company')).toBe(true);
  });

  it('allows admin based on configured permissions', () => {
    const access = {
      paths: ['/pos'],
      permissions: ['pos.view', 'pos.retail', 'pos.print']
    };
    expect(hasPermission('admin', 'pos.view', access)).toBe(true);
    expect(hasPermission('admin', 'pos.retail', access)).toBe(true);
    expect(hasPermission('admin', 'pos.custom_price', access)).toBe(false);
    expect(hasPermission('admin', 'customers.delete', access)).toBe(false);
  });

  it('falls back to default permissions for unconfigured admin', () => {
    expect(hasPermission('admin', 'pos.view', null)).toBe(true);
    expect(hasPermission('admin', 'pos.retail', null)).toBe(true);
    expect(hasPermission('admin', 'settings.company', null)).toBe(false);
  });
});
