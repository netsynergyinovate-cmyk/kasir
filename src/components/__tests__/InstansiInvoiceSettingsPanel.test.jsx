import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const rpcMock = vi.fn();
const updateMock = vi.fn();
let updateResult;

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { invoice_cs_name: 'Budi', invoice_bank_name: 'BRI' }, error: null }) }),
      }),
      update: (payload) => {
        updateMock(payload);
        return { eq: () => ({ select: () => Promise.resolve(updateResult) }) };
      },
    }),
  },
}));

import InstansiInvoiceSettingsPanel from '../InstansiInvoiceSettingsPanel';

describe('InstansiInvoiceSettingsPanel', () => {
  let container;
  let root;

  beforeEach(async () => {
    rpcMock.mockReset();
    updateMock.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<InstansiInvoiceSettingsPanel />); });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const submit = async () => {
    await act(async () => { container.querySelector('button[type="submit"]').click(); });
  };

  it('memuat nilai tersimpan dan menyimpan lewat fungsi SQL', async () => {
    expect(container.querySelector('#invoice_cs_name').value).toBe('Budi');
    expect(container.querySelector('#invoice_bank_name').value).toBe('BRI');
    rpcMock.mockResolvedValue({ error: null });
    await submit();
    expect(rpcMock).toHaveBeenCalledWith('save_instansi_invoice_settings', {
      p: expect.objectContaining({ invoice_cs_name: 'Budi', invoice_bank_name: 'BRI', invoice_bank_account: '' }),
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]').textContent).toContain('Tersimpan');
  });

  it('fungsi SQL belum dipasang: tulis langsung, beri tahu kalau RLS menolak', async () => {
    rpcMock.mockResolvedValue({ error: { code: 'PGRST202', message: 'not found' } });
    updateResult = { data: [], error: null };
    await submit();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ invoice_cs_name: 'Budi', invoice_bank_account: null }));
    expect(container.querySelector('[role="status"]').textContent).toContain('supabase_instansi_invoice_settings.sql');
  });
});
