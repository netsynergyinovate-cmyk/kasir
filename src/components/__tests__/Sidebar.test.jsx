import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

const render = (role) => renderToString(
  <MemoryRouter>
    <Sidebar isOpen setIsOpen={() => {}} companyInfo={{ name: 'NetSI' }} session={{ profile: { role, full_name: 'Tester' } }} />
  </MemoryRouter>
).replace(/<!-- -->/g, '');

describe('Sidebar Rute Kunjungan link', () => {
  it('is shown to the superadmin', () => {
    expect(render('superadmin')).toContain('Rute Kunjungan');
  });

  it('is hidden from an admin', () => {
    expect(render('admin')).not.toContain('Rute Kunjungan');
  });
});
