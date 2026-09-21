import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const render = (role) => renderToString(<MemoryRouter><Navigation role={role} /></MemoryRouter>).replace(/<!-- -->/g, '');

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
});
