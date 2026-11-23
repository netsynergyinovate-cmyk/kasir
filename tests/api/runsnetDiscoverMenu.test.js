import { describe, it, expect, vi, afterEach } from 'vitest';
import { discoverMenuMap } from '../../api/_lib/runsnetClient.js';

const KEY = 'S0VZ';
const link = (value, label) => `<li >\n                        <a href="?${KEY}=${value}">\n                            <i class="fa fa-file-pdf-o"></i>\n                            <span>${label}</span>\n                        </a>\n                    </li>`;
const dataScript = (js) => `<script src="data:text/javascript;charset=utf-8;base64,${Buffer.from(js).toString('base64')}"></script>`;
const page = (js, extra = '') => `<!doctype html><html><head><meta name="csrf-token" content="tok123"></head><body>${extra}${dataScript(js)}</body></html>`;

// Bentuk HTML Runsnet setelah update UI 2026-11: indentasi menu panjang, script di data: base64, token CSRF di <meta>.
describe('discoverMenuMap (UI Runsnet 2026-11)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('membaca menu, aksi bayar/reversal dari script base64, dan token CSRF', async () => {
    const responses = {
      function_get_menu: link('INVV', 'Invoice') + link('PAYV', 'Payment') + link('CUSV', 'Pelanggan'),
      INVV: page(`function createpayment() {\n window.open('?${KEY}=DOPAY&data1=' + array, '_self');\n}`),
      PAYV: page(`function createreversal() {\n window.open('?${KEY}=DOREV&data1=' + array + '', '_self');\n}`),
      CUSV: page('', `<a href="?${KEY}=ADDC"><b><i class="fa fa-plus-square"></i> Tambah Data</b></a>`),
    };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url);
      const hit = u.includes('function_get_menu') ? 'function_get_menu' : new URL(u).searchParams.get(KEY);
      return { text: async () => responses[hit] };
    }));

    expect(await discoverMenuMap('c=1')).toEqual({
      menuKeyParam: KEY,
      invoiceListMenuValue: 'INVV',
      paymentPageMenuValue: 'PAYV',
      customersMenuValue: 'CUSV',
      paymentMenuValue: 'DOPAY',
      reversalMenuValue: 'DOREV',
      addCustomerMenuValue: 'ADDC',
      csrfToken: 'tok123',
    });
  });
});
