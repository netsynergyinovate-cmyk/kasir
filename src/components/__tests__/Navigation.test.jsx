import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const render = (role, allowedPaths) => renderToString(<MemoryRouter><Navigation role={role} allowedPaths={allowedPaths} /></MemoryRouter>).replace(/<!-- -->/g, '');

describe('bottom Navigation', () => {
  it('gives the superadmin a Rute menu right next to Setting', () => {
    const html = render('superadmin');
    const rute = html.indexOf('href="/rute"');
    expect(rute).toBeGreaterThan(html.indexOf('href="/history"'));
    expect(html.indexOf('href="/settings"')).toBeGreaterThan(rute);
    expect(html).toContain('>Rute<');
  });

  it('does not show the Rute menu to an admin (the route is on their dashboard)', () => {
    const html = render('admin');
    expect(html).not.toContain('href="/rute"');
    expect(html).not.toContain('>Rute<');
  });

  it('keeps the existing menus for both roles', () => {
    ['admin', 'superadmin'].forEach((role) => {
      const html = render(role);
      ['href="/"', 'href="/customers"', 'href="/history"', 'href="/settings"', 'href="/pos"'].forEach((link) => {
        expect(html).toContain(link);
      });
    });
  });

  it('only shows the menus a specific admin was granted by superadmin', () => {
    const html = render('admin', ['/pos', '/history']);
    expect(html).toContain('href="/pos"');
    expect(html).toContain('href="/history"');
    expect(html).not.toContain('href="/"');
    expect(html).not.toContain('href="/customers"');
    expect(html).not.toContain('href="/settings"');
  });

  it('ignores allowedPaths for superadmin (always sees everything)', () => {
    const html = render('superadmin', []);
    expect(html).toContain('href="/pos"');
    expect(html).toContain('href="/customers"');
    expect(html).toContain('href="/settings"');
  });
});
