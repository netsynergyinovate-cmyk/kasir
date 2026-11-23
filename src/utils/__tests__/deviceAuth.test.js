import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyDevice, forgetDeviceAuth } from '../deviceAuth';

describe('deviceAuth: kunci layar perangkat', () => {
  const create = vi.fn();
  const get = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    create.mockReset().mockResolvedValue({ rawId: new Uint8Array([1, 2, 3]).buffer });
    get.mockReset().mockResolvedValue({});
    Object.defineProperty(navigator, 'credentials', { value: { create, get }, configurable: true });
  });

  it('pertama kali mendaftar (create), berikutnya memverifikasi kredensial yang sama (get)', async () => {
    await verifyDevice('u1', 'Budi');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].publicKey.authenticatorSelection.userVerification).toBe('required');

    await verifyDevice('u1', 'Budi');
    expect(create).toHaveBeenCalledTimes(1);
    const { allowCredentials, userVerification } = get.mock.calls[0][0].publicKey;
    expect(userVerification).toBe('required');
    expect([...allowCredentials[0].id]).toEqual([1, 2, 3]);
  });

  it('verifikasi gagal/dibatalkan melempar error (tidak membuka kunci)', async () => {
    await verifyDevice('u1');
    get.mockRejectedValueOnce(new DOMException('cancel', 'NotAllowedError'));
    await expect(verifyDevice('u1')).rejects.toThrow();
  });

  it('forgetDeviceAuth membuat perangkat mendaftar ulang', async () => {
    await verifyDevice('u1');
    forgetDeviceAuth('u1');
    await verifyDevice('u1');
    expect(create).toHaveBeenCalledTimes(2);
    expect(get).not.toHaveBeenCalled();
  });
});
