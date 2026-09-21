import { describe, it, expect } from 'vitest';
import { shouldUploadLocation, describeLocationAge, buildRoutePoints, legIndexFor } from '../location';

const here = { lat: -6.2, lng: 106.8 };

describe('shouldUploadLocation', () => {
  const now = 1_000_000;

  it('uploads the very first position', () => {
    expect(shouldUploadLocation(null, here, now)).toBe(true);
  });

  it('skips a tiny move shortly after the last upload', () => {
    const last = { ...here, at: now - 10_000 };
    expect(shouldUploadLocation(last, { lat: -6.20001, lng: 106.8 }, now)).toBe(false);
  });

  it('uploads when the admin moved more than 30 metres', () => {
    const last = { ...here, at: now - 10_000 };
    expect(shouldUploadLocation(last, { lat: -6.2005, lng: 106.8 }, now)).toBe(true);
  });

  it('uploads a heartbeat after 60 seconds even without moving', () => {
    const last = { ...here, at: now - 61_000 };
    expect(shouldUploadLocation(last, here, now)).toBe(true);
  });
});

describe('describeLocationAge', () => {
  const now = new Date('2026-09-21T12:00:00');

  it('marks a fresh position as active', () => {
    expect(describeLocationAge('2026-09-21T11:58:00', now)).toEqual({ label: '2 menit lalu', stale: false });
  });

  it('marks a position older than 10 minutes as stale', () => {
    expect(describeLocationAge('2026-09-21T11:30:00', now)).toEqual({ label: '30 menit lalu', stale: true });
  });

  it('treats "just now" as active', () => {
    expect(describeLocationAge('2026-09-21T11:59:50', now)).toEqual({ label: 'Baru saja', stale: false });
  });
});

describe('buildRoutePoints and legIndexFor', () => {
  const stops = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }];

  it('starts the road route at the admin position when it is known', () => {
    const points = buildRoutePoints({ lat: 0, lng: 0 }, stops);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ lat: 0, lng: 0 });
  });

  it('uses only the stops when the position is unknown', () => {
    expect(buildRoutePoints(null, stops)).toHaveLength(3);
  });

  it('maps each stop to the leg that arrives at it', () => {
    // dengan posisi admin: leg 0 = admin -> stop 0, leg 1 = stop 0 -> stop 1
    expect(legIndexFor(true, 0)).toBe(0);
    expect(legIndexFor(true, 2)).toBe(2);
    // tanpa posisi: stop pertama tidak punya leg masuk
    expect(legIndexFor(false, 0)).toBe(-1);
    expect(legIndexFor(false, 2)).toBe(1);
  });
});
