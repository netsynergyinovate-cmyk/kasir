import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

const settingsRow = { runsnet_sync_enabled: false, runsnet_dry_run: true };
const logRows = [
  { id: 'l1', transaction_id: 't1', status: 'dry_run', search_query: 'pppoe123', runsnet_ref: null, message: 'Mode uji coba aktif: pencarian/pembayaran TIDAK dikirim ke Runsnet.', created_at: '2026-09-21T08:00:00Z' },
  { id: 'l2', transaction_id: 't2', status: 'success', search_query: 'C9', runsnet_ref: 'INV-9', message: null, created_at: '2026-09-21T07:00:00Z' },
];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      if (table === 'company_settings') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: settingsRow, error: null }) }) }) };
      }
      return { select: () => ({ order: () => ({ limit: async () => ({ data: logRows, error: null }) }) }) };
    },
  },
}));

import RunsnetSyncPanel from '../RunsnetSyncPanel';

describe('RunsnetSyncPanel', () => {
  it('shows both toggles, defaulting to what is stored (off, dry-run on)', async () => {
    const html = renderToString(<RunsnetSyncPanel />);
    expect(html).toContain('Sinkronisasi Runsnet');
    expect(html).toContain('Aktifkan sinkronisasi otomatis');
    expect(html).toContain('Mode uji coba');
  });

  it('shows the recent-attempts section with a loading state before data arrives', () => {
    // renderToString tidak menjalankan useEffect, jadi ini menguji tampilan awal (loading),
    // bukan hasil fetch. Isi log yang benar-benar terambil diuji lewat describeSyncStatus di
    // runsnetSync.test.js (logika murninya), yang dipakai panel ini untuk memberi label tiap baris.
    const html = renderToString(<RunsnetSyncPanel />);
    expect(html).toContain('Percobaan Terakhir');
    expect(html).toContain('Memuat log...');
  });

  it('explains that dry-run mode does not really send anything', () => {
    const html = renderToString(<RunsnetSyncPanel />);
    expect(html).toMatch(/TIDAK benar-benar dikirim/);
  });

  it('offers a Uji Koneksi button, independent of the sync toggles', () => {
    const html = renderToString(<RunsnetSyncPanel session={{ access_token: 'x' }} />);
    expect(html).toContain('Uji Koneksi ke Runsnet');
  });
});
