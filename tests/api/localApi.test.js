import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveApiFile } from '../../vite-plugin-local-api.js';

const apiDir = path.resolve('/proj/api');

describe('resolveApiFile', () => {
  it('maps /api/admin/create-user to api/admin/create-user.js', () => {
    expect(resolveApiFile('/api/admin/create-user', apiDir)).toBe(path.join(apiDir, 'admin', 'create-user.js'));
  });

  it('ignores the query string', () => {
    expect(resolveApiFile('/api/admin/create-user?x=1', apiDir)).toBe(path.join(apiDir, 'admin', 'create-user.js'));
  });

  it('rejects path traversal', () => {
    expect(resolveApiFile('/api/../package.json', apiDir)).toBeNull();
    expect(resolveApiFile('/api/admin/../../secret', apiDir)).toBeNull();
  });

  it('does not expose private helper folders or files starting with an underscore', () => {
    expect(resolveApiFile('/api/_lib/verifySuperadmin', apiDir)).toBeNull();
  });

  it('returns null for an empty api path', () => {
    expect(resolveApiFile('/api/', apiDir)).toBeNull();
  });
});
