import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import RunsnetCustomerPicker from '../RunsnetCustomerPicker';

vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // biarkan menggantung; SSR tidak menjalankan efeknya

describe('RunsnetCustomerPicker', () => {
  it('renders the picker with a search box and a disabled import button (nothing selected yet)', () => {
    const html = renderToString(
      <RunsnetCustomerPicker session={{ access_token: 'x' }} existingCustids={new Set()} onClose={() => {}} onImported={() => {}} />
    );
    expect(html).toContain('Pilih Pelanggan dari Runsnet');
    expect(html).toContain('Cari nama / CustID');
    expect(html).toContain('Impor Terpilih (0)');
    expect(html).toContain('disabled');
  });
});
