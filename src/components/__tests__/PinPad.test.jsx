import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../../utils/authProfile', () => ({
  fetchApproxLocation: () => Promise.resolve({ location: 'Mukomuko, Indonesia', ip: '1.2.3.4' }),
}));

import PinPad from '../PinPad';

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

describe('PinPad: PIN per akun', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const typePin = async (pin) => {
    for (const digit of pin) {
      const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === digit);
      await act(async () => { btn.click(); });
    }
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  };

  it('akun dengan PIN sendiri: PIN akun membuka, PIN bersama ditolak', async () => {
    const onUnlock = vi.fn();
    const dbPin = await sha256('070809');
    await act(async () => { root.render(<PinPad dbPin={dbPin} accountPin="123456" accountName="Budi" onUnlock={onUnlock} />); });
    expect(container.textContent).toContain('Masuk sebagai Budi');
    expect(container.textContent).toContain('Mukomuko, Indonesia');

    await typePin('070809');
    expect(onUnlock).not.toHaveBeenCalled();
    await typePin('123456');
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('akun tanpa PIN sendiri tetap memakai PIN bersama', async () => {
    const onUnlock = vi.fn();
    const dbPin = await sha256('070809');
    await act(async () => { root.render(<PinPad dbPin={dbPin} onUnlock={onUnlock} />); });
    await typePin('070809');
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
