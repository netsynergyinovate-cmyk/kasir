import { describe, it, expect } from 'vitest';
import { TILE_LAYERS, MAP_MAX_ZOOM } from '../mapConfig';

describe('map tile configuration', () => {
  it('defines a satellite layer with road and place labels for a hybrid view', () => {
    expect(TILE_LAYERS.satellite.url).toContain('World_Imagery');
    expect(TILE_LAYERS.transportation.url).toContain('World_Transportation');
    expect(TILE_LAYERS.places.url).toContain('World_Boundaries_and_Places');
  });

  it('uses the ArcGIS {z}/{y}/{x} order for Esri tiles and {z}/{x}/{y} for OpenStreetMap', () => {
    ['satellite', 'transportation', 'places'].forEach((name) => {
      expect(TILE_LAYERS[name].url).toMatch(/tile\/\{z\}\/\{y\}\/\{x\}$/);
    });
    expect(TILE_LAYERS.street.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('lets users zoom past the native tile zoom so tiles are scaled instead of disappearing', () => {
    Object.values(TILE_LAYERS).forEach((layer) => {
      expect(layer.maxZoom).toBe(MAP_MAX_ZOOM);
      expect(layer.maxNativeZoom).toBeLessThan(MAP_MAX_ZOOM);
    });
  });

  it('keeps the satellite native zoom within safe coverage', () => {
    expect(TILE_LAYERS.satellite.maxNativeZoom).toBeLessThanOrEqual(18);
  });

  it('credits every tile provider', () => {
    expect(TILE_LAYERS.satellite.attribution).toContain('Esri');
    expect(TILE_LAYERS.street.attribution).toContain('OpenStreetMap');
  });
});
