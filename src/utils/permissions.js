export const ADMIN_ALLOWED_PATHS = ['/', '/pos', '/customers', '/settings'];
export const ADMIN_DEFAULT_PATH = '/pos';

export function isPathAllowedForRole(role, pathname) {
  if (role === 'superadmin') return true;
  return ADMIN_ALLOWED_PATHS.includes(pathname);
}
