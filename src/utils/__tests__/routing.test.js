import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRouteUrl, fetchRoadRoute } from '../routing';

const points = [{ lat: -6.2, lng: 106.8 }, { lat: -6.21, lng: 106.81 }, { lat: -6.22, lng: 106.82 }];

const okResponse = {
  ok: true,
  json: async () => ({
    code: 'Ok',
    routes: [{
      distance: 5000,
      duration: 600,
      geometry: { coordinates: [[106.8, -6.2], [106.805, -6.205], [106.82, -6.22]] },
      legs: [{ distance: 2000, duration: 240 }, { distance: 3000, duration: 360 }],
    }],
  }),
};

describe('buildRouteUrl', () => {
  it('puts coordinates in lng,lat order separated by semicolons', () => {
    const url = buildRouteUrl(points);
    expect(url).toContain('/driving/106.8,-6.2;106.81,-6.21;106.82,-6.22');
    expect(url).toContain('overview=full');
    expect(url).toContain('geometries=geojson');
  });
});

describe('fetchRoadRoute', () => {
  beforeEach(() => localStorage.clear());

  it('returns null without calling the network when there are fewer than two points', async () => {
    const fetchImpl = vi.fn();
    expect(await fetchRoadRoute([points[0]], { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('converts geometry to [lat, lng] and returns per-leg distance and duration', async () => {
    const fetchImpl = vi.fn(async () => okResponse);
    const route = await fetchRoadRoute(points, { fetchImpl });
    expect(route.coordinates[0]).toEqual([-6.2, 106.8]);
    expect(route.legs).toEqual([{ distance: 2000, duration: 240 }, { distance: 3000, duration: 360 }]);
    expect(route.distance).toBe(5000);
    expect(route.duration).toBe(600);
  });

  it('serves a repeated request from the cache', async () => {
    const fetchImpl = vi.fn(async () => okResponse);
    await fetchRoadRoute(points, { fetchImpl });
    await fetchRoadRoute(points, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null when the service fails or finds no route', async () => {
    expect(await fetchRoadRoute(points, { fetchImpl: vi.fn(async () => ({ ok: false })) })).toBeNull();
    expect(await fetchRoadRoute(points, { fetchImpl: vi.fn(async () => { throw new Error('offline'); }) })).toBeNull();
    expect(await fetchRoadRoute(points, { fetchImpl: vi.fn(async () => ({ ok: true, json: async () => ({ code: 'NoRoute' }) })) })).toBeNull();
  });
});
