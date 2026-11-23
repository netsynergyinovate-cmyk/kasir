import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// Satu invoice dibayar lewat KAsir (AGUS, admin), satu sudah dibayar langsung di billing Runsnet.
const logRows = [
  { id: 'a', transaction_id: 't1', stage: 'payment', status: 'success', search_query: 'INVRT1', runsnet_ref: 'INVRT1', customer_name: 'NGADIO', message: 'Invoice INVRT1 terbukti berstatus PAID di Runsnet.', created_at: '2026-11-21T07:10:00Z' },
  { id: 'b', transaction_id: 't2', stage: 'payment', status: 'success', search_query: 'SUYONO', runsnet_ref: 'INVRT2', customer_name: 'SUYONO', message: 'Tagihan 2026-11-01 sudah PAID di Runsnet, tidak dibayar ulang — dibayar langsung di aplikasi billing Runsnet.', created_at: '2026-11-23T07:10:00Z' },
];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      if (table === 'company_settings') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { runsnet_sync_enabled: true, runsnet_dry_run: false } }) }) }) };
      if (table === 'transactions') return { select: () => ({ in: async () => ({ data: [{ id: 't1', customer_name: 'NGADIO', price: 200000, cashier_name: 'AGUS PITONO', cashier_id: 'u1' }, { id: 't2', customer_name: 'SUYONO', price: 200000, cashier_name: 'CS', cashier_id: 'u2' }] }) }) };
      if (table === 'admin_profiles') return { select: async () => ({ data: [{ id: 'u1', role: 'admin' }, { id: 'u2', role: 'superadmin' }] }) };
      return { select: () => ({ order: () => ({ limit: async () => ({ data: logRows }) }) }) };
    },
  },
}));

import RunsnetSyncPanel from '../RunsnetSyncPanel';

describe('RunsnetSyncPanel status Runsnet', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        statuses: { INVRT1: 'PAID', INVRT2: 'PAID' },
        payments: { INVRT2: { paymentCode: 'PAY202611000984', payDate: '2026-11-22', amount: '250,000' } },
        customers: { NGADIO: { connection: 'Sambungan Terputus', status: 'Active' }, SUYONO: { connection: 'Terhubung', status: 'Active' } },
        checkedAt: '2026-11-23T08:00:00Z',
      }),
    })));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('shows bill status, who paid (KAsir + role vs Runsnet directly) and connection per card', async () => {
    await act(async () => { root.render(<RunsnetSyncPanel session={{ access_token: 'x' }} />); });
    await act(async () => {});
    const text = container.textContent;
    expect(text).toContain('Sudah dibayar');
    expect(text).toContain('AGUS PITONO');
    expect(text).toContain('Admin · via KAsir');
    expect(text).toContain('Billing Runsnet');
    expect(text).toContain('Langsung · PAY202611000984');
    expect(text).toContain('Terhubung');
    expect(text).toContain('Terputus');
    expect(text).toContain('dibaca langsung dari Runsnet');
  });
});
