import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrCreateDeviceId, getDeviceLabel } from '../deviceId';

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates and persists a device id on first call', () => {
    const id = getOrCreateDeviceId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem('kasir_device_id')).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });
});

describe('getDeviceLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels a Chrome-on-Windows user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });
    expect(getDeviceLabel()).toBe('Chrome di Windows');
  });

  it('labels a Safari-on-iPhone user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(getDeviceLabel()).toBe('Safari di iOS');
  });

  it('falls back to a generic label for an unknown user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'SomeWeirdBot/1.0' });
    expect(getDeviceLabel()).toBe('Browser Tidak Dikenal di OS Tidak Dikenal');
  });
});
