import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) },
}));

import RunsnetSyncToast from '../RunsnetSyncToast';

describe('RunsnetSyncToast', () => {
  it('renders nothing before any transaction is being watched', () => {
    // renderToString tidak menjalankan useEffect (polling), jadi ini menguji tampilan awal:
    // tanpa watchId, tidak ada apa pun yang dirender. Logika pemilihan warna diuji terpisah
    // lewat syncToastTone di runsnetSync.test.js.
    expect(renderToString(<RunsnetSyncToast watchId={null} />)).toBe('');
  });

  it('also renders nothing on the very first paint even with a watchId (waits for the poll)', () => {
    expect(renderToString(<RunsnetSyncToast watchId="INV-1" />)).toBe('');
  });
});
