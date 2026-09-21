import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const html = renderToString(<MemoryRouter><Navigation /></MemoryRouter>).replace(/<!-- -->/g, '');

describe('bottom Navigation', () => {
  it('has its own Rute menu linking to the visit route page', () => {
    expect(html).toContain('href="/rute"');
    expect(html).toContain('>Rute<');
  });

  it('places the Rute menu right next to Setting', () => {
    const rute = html.indexOf('href="/rute"');
    const setting = html.indexOf('href="/settings"');
    const history = html.indexOf('href="/history"');
    expect(rute).toBeGreaterThan(history);
    expect(setting).toBeGreaterThan(rute);
  });

  it('keeps the existing menus', () => {
    ['href="/"', 'href="/customers"', 'href="/history"', 'href="/settings"', 'href="/pos"'].forEach((link) => {
      expect(html).toContain(link);
    });
  });
});
