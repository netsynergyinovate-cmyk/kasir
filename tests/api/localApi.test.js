import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApiFile } from '../../vite-plugin-local-api.js';

const apiDir = path.resolve('/proj/api');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('resolveApiFile', () => {
  it('maps /api/runsnet/ping to api/runsnet/ping.js', () => {
    expect(resolveApiFile('/api/runsnet/ping', apiDir)).toBe(path.join(apiDir, 'runsnet', 'ping.js'));
  });

  it('ignores the query string', () => {
    expect(resolveApiFile('/api/runsnet/ping?x=1', apiDir)).toBe(path.join(apiDir, 'runsnet', 'ping.js'));
  });

  it('rejects path traversal', () => {
    expect(resolveApiFile('/api/../package.json', apiDir)).toBeNull();
    expect(resolveApiFile('/api/runsnet/../../secret', apiDir)).toBeNull();
  });

  it('does not expose private helper folders or files starting with an underscore', () => {
    expect(resolveApiFile('/api/_lib/verifySuperadmin', apiDir)).toBeNull();
  });

  it('returns null for an empty api path', () => {
    expect(resolveApiFile('/api/', apiDir)).toBeNull();
  });

  it('maps directory index like /api/watbiz to api/watbiz/index.js if index.js exists', () => {
    const realApiDir = path.resolve(__dirname, '../../api');
    expect(resolveApiFile('/api/watbiz', realApiDir)).toBe(path.join(realApiDir, 'watbiz', 'index.js'));
  });

  it('rewrites subpaths like /api/watbiz/webhook to api/watbiz/index.js', () => {
    const realApiDir = path.resolve(__dirname, '../../api');
    expect(resolveApiFile('/api/watbiz/webhook', realApiDir)).toBe(path.join(realApiDir, 'watbiz', 'index.js'));
  });
});
