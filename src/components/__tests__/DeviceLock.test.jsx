import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const signInWithPassword = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn(), signInWithPassword: (...a) => signInWithPassword(...a) } } }));
vi.mock('../../utils/authProfile', () => ({ fetchApproxLocation: () => Promise.resolve({ location: null, ip: null }) }));
const verifyDevice = vi.fn();
vi.mock('../../utils/deviceAuth', () => ({
  isDeviceAuthAvailable: () => Promise.resolve(true),
  verifyDevice: (...a) => verifyDevice(...a),
  forgetDeviceAuth: vi.fn(),
}));

import DeviceLock from '../DeviceLock';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('DeviceLock: opsi cadangan setelah 3x gagal', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    verifyDevice.mockReset().mockRejectedValue(new Error('NotAllowedError'));
    signInWithPassword.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const clickUnlock = async () => {
    const btn = [...container.querySelectorAll('button')].find((b) => /Buka Kunci|Sandi/.test(b.textContent));
    await act(async () => { btn.click(); });
    await flush();
  };

  it('form password baru muncul setelah 3x gagal, lalu password benar membuka kunci', async () => {
    const onUnlock = vi.fn();
    await act(async () => { root.render(<DeviceLock userId="u1" email="a@b.c" onUnlock={onUnlock} />); });
    await flush(); // percobaan otomatis = gagal ke-1
    expect(container.querySelector('#lockPassword')).toBeNull();

    await clickUnlock(); // ke-2
    expect(container.querySelector('#lockPassword')).toBeNull();
    await clickUnlock(); // ke-3
    expect(container.querySelector('#lockPassword')).not.toBeNull();
    expect(container.textContent).toContain('Pakai Sandi / PIN HP');

    signInWithPassword.mockResolvedValueOnce({ error: { message: 'bad' } });
    const input = container.querySelector('#lockPassword');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => { setValue.call(input, 'salah'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { container.querySelector('form').requestSubmit(); });
    await flush();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Password salah.');

    signInWithPassword.mockResolvedValueOnce({ error: null });
    await act(async () => { container.querySelector('form').requestSubmit(); });
    await flush();
    expect(signInWithPassword).toHaveBeenLastCalledWith({ email: 'a@b.c', password: 'salah' });
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('device_unlocked')).toBe('true');
  });

  it('verifikasi perangkat berhasil langsung membuka kunci', async () => {
    verifyDevice.mockResolvedValue();
    const onUnlock = vi.fn();
    await act(async () => { root.render(<DeviceLock userId="u1" onUnlock={onUnlock} />); });
    await flush();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
