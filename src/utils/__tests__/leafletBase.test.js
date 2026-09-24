import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { createBaseLayers } from '../leafletBase';

describe('leafletBase layer creation', () => {
  it('generates valid tile URLs for satellite and street layers', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const map = L.map(div).setView([0, 0], 5);

    const { street, satellite } = createBaseLayers(map, 'satellite');

    const satUrl = satellite.getTileUrl({ x: 10, y: 10, z: 5 });
    const streetUrl = street.getTileUrl({ x: 10, y: 10, z: 5 });

    console.log('Sample sat URL:', satUrl);
    console.log('Sample street URL:', streetUrl);

    expect(satUrl).toMatch(/^https:\/\/mt[0-3]\.google\.com\/vt\/lyrs=y&x=10&y=10&z=5$/);

    // Test switching to street and back to satellite
    const layers = createBaseLayers(map, 'satellite');
    expect(map.hasLayer(layers.satellite)).toBe(true);
    expect(map.hasLayer(layers.street)).toBe(false);

    layers.setLayer('street');
    expect(map.hasLayer(layers.street)).toBe(true);
    expect(map.hasLayer(layers.satellite)).toBe(false);

    layers.setLayer('satellite');
    expect(map.hasLayer(layers.satellite)).toBe(true);
    expect(map.hasLayer(layers.street)).toBe(false);

    map.remove();
    div.remove();
  });
});
