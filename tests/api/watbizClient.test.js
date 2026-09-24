import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendWatbizMessage } from '../../api/_lib/watbizClient.js';

const mockFetch = (status, body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }));
};

describe('watbizClient success detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [{ status: 'success' }],
    [{ status: true }],
    [{ status: 200 }],
    [{ success: true }],
  ])('treats explicit success body %j as ok', async (body) => {
    mockFetch(200, body);
    const result = await sendWatbizMessage('tok', { number: '6281', message: 'hi' });
    expect(result.ok).toBe(true);
  });

  it.each([
    [{ message: 'Device offline' }],
    [{ status: 'error', message: 'Device offline' }],
    [{ status: 'success', error: 'quota habis' }],
    ['Bad gateway'],
  ])('does not treat plain HTTP 200 body %j as ok', async (body) => {
    mockFetch(200, body);
    const result = await sendWatbizMessage('tok', { number: '6281', message: 'hi' });
    expect(result.ok).toBe(false);
  });

  it('is not ok on non-2xx even with success body', async () => {
    mockFetch(500, { status: 'success' });
    const result = await sendWatbizMessage('tok', { number: '6281', message: 'hi' });
    expect(result.ok).toBe(false);
  });
});
