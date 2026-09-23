import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
// Leaflet butuh browser sungguhan; peta tidak diuji di sini (sama seperti Rute.test.jsx).
vi.mock('../../components/LocationPicker', () => ({ default: () => <div /> }));

import TambahPelangganRunsnet from '../TambahPelangganRunsnet';

const render = () => renderToString(
  <MemoryRouter>
    <TambahPelangganRunsnet session={{ access_token: 'tok' }} />
  </MemoryRouter>,
).replace(/<!-- -->/g, '');

describe('TambahPelangganRunsnet wizard', () => {
  it('starts on step 1, showing Data Pelanggan fields only', () => {
    const html = render();
    expect(html).toContain('Nama Pelanggan');
    expect(html).toContain('Kontak');
    expect(html).not.toContain('Titik Koordinat');
    expect(html).not.toContain('Paket (Profile)');
    expect(html).not.toContain('Username Access');
  });

  it('shows the step indicator with all 4 labels', () => {
    const html = render();
    expect(html).toContain('Data');
    expect(html).toContain('Lokasi');
    expect(html).toContain('Paket');
    expect(html).toContain('Ringkasan');
  });

  it('disables Lanjut until Nama and Kontak are filled', () => {
    const html = render();
    expect(html).toContain('Lengkapi dulu:');
    expect(html).toContain('Nama pelanggan wajib diisi.');
    expect(html).toContain('Nomor kontak wajib diisi.');
  });

  it('keeps the exit-to-customers back button on step 1', () => {
    const html = render();
    // ArrowLeft icon button is always rendered; step-1 "Lanjut" button should also be present (not "Kirim ke Runsnet").
    expect(html).toContain('Lanjut');
    expect(html).not.toContain('Kirim ke Runsnet');
  });
});
