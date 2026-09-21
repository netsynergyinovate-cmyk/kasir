import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import RunsnetSyncToast from '../RunsnetSyncToast';

describe('RunsnetSyncToast', () => {
  it('renders nothing when there is no result yet', () => {
    expect(renderToString(<RunsnetSyncToast result={null} />)).toBe('');
  });

  it('shows the proven PAID status and the message from the server (same for admin and superadmin)', () => {
    const html = renderToString(<RunsnetSyncToast result={{ status: 'success', message: 'Invoice INVRT1 terbukti berstatus PAID di Runsnet.' }} />);
    expect(html).toContain('PAID di Runsnet');
    expect(html).toContain('INVRT1 terbukti berstatus PAID');
    expect(html).toContain('bg-emerald-600');
  });

  it('shows failures in red with the reason', () => {
    const html = renderToString(<RunsnetSyncToast result={{ status: 'failed', message: 'Langkah 2 dari 3 gagal: Sesi login Runsnet tidak valid' }} />);
    expect(html).toContain('bg-red-600');
    expect(html).toContain('Sesi login Runsnet tidak valid');
  });

  it('marks dry-run as not sent', () => {
    const html = renderToString(<RunsnetSyncToast result={{ status: 'dry_run', message: 'MODE UJI COBA' }} />);
    expect(html).toContain('TIDAK dikirim');
  });
});
