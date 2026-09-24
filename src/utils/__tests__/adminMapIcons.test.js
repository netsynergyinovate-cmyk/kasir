import { describe, it, expect } from 'vitest';
import { 
  MAP_ICON_TYPES, 
  MAP_ICON_COLORS, 
  getDeterministicColor, 
  getInitials, 
  createAdminMapIcon 
} from '../adminMapIcons';

describe('adminMapIcons', () => {
  it('defines 7 map icon types with SVG and iconText', () => {
    expect(MAP_ICON_TYPES).toHaveLength(7);
    const ids = MAP_ICON_TYPES.map(t => t.id);
    expect(ids).toContain('motor');
    expect(ids).toContain('mobil');
    expect(ids).toContain('technician');
    expect(ids).toContain('person');
    expect(ids).toContain('admin');
    expect(ids).toContain('crown');
    expect(ids).toContain('beacon');

    MAP_ICON_TYPES.forEach(t => {
      expect(t.svg).toContain('<svg');
      expect(t.iconText).toBeDefined();
      expect(t.label).toBeDefined();
    });
  });

  it('defines 8 vibrant theme colors', () => {
    expect(MAP_ICON_COLORS).toHaveLength(8);
    MAP_ICON_COLORS.forEach(c => {
      expect(c.value).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('generates deterministic color from string', () => {
    const color1 = getDeterministicColor('Budi Santoso');
    const color2 = getDeterministicColor('Budi Santoso');
    const color3 = getDeterministicColor('Ahmad Dahlan');
    expect(color1).toBe(color2);
    expect(typeof color1).toBe('string');
    expect(color1).toMatch(/^#/);
    expect(MAP_ICON_COLORS.map(c => c.value)).toContain(color1);
  });

  it('extracts initials properly', () => {
    expect(getInitials('Budi Santoso')).toBe('BS');
    expect(getInitials('Agus')).toBe('A');
    expect(getInitials('Muhammad Rizki Pratama')).toBe('MR');
    expect(getInitials('')).toBe('?');
  });

  it('creates Leaflet divIcon with proper dimensions and custom config', () => {
    const icon = createAdminMapIcon({
      id: 'admin-1',
      name: 'Rudi Teknisi',
      role: 'admin',
      map_icon: {
        type: 'technician',
        color: '#10b981',
        label: 'RT'
      }
    });

    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-admin-marker');
    expect(icon.options.iconSize).toEqual([40, 48]);
    expect(icon.options.html).toContain('Rudi Teknisi');
    expect(icon.options.html).toContain('#10b981');
    expect(icon.options.html).toContain('RT');
  });

  it('handles superadmin role and self location marker', () => {
    const iconSuper = createAdminMapIcon({
      id: 'super-1',
      name: 'Owner',
      role: 'superadmin'
    });
    expect(iconSuper.options.html).toContain('👑');

    const iconSelf = createAdminMapIcon({
      id: 'self-1',
      name: 'Saya',
      role: 'admin'
    }, true);
    expect(iconSelf.options.html).toContain('Posisi Anda');
  });
});
