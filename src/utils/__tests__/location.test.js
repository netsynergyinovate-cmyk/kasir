import { describe, it, expect } from 'vitest';
import { shouldUploadLocation, describeLocationAge, buildRoutePoints, legIndexFor, locationAdvice, accuracyLevel } from '../location';

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

  it('uploads a real move (more than 10 metres) once 5 seconds have passed', () => {
    const last = { ...here, at: now - 6_000 };
    expect(shouldUploadLocation(last, { lat: -6.2002, lng: 106.8 }, now)).toBe(true); // sekitar 22 m
  });

  it('does not flood the server: at most one upload per 5 seconds while moving', () => {
    const last = { ...here, at: now - 3_000 };
    expect(shouldUploadLocation(last, { lat: -6.2005, lng: 106.8 }, now)).toBe(false);
  });

  it('ignores a small move of a few metres (GPS jitter)', () => {
    const last = { ...here, at: now - 20_000 };
    expect(shouldUploadLocation(last, { lat: -6.20005, lng: 106.8 }, now)).toBe(false); // sekitar 5 m
  });

  it('uploads a heartbeat after 30 seconds even without moving', () => {
    const last = { ...here, at: now - 31_000 };
    expect(shouldUploadLocation(last, here, now)).toBe(true);
  });
});

describe('accuracyLevel', () => {
  it('rates GPS accuracy in metres', () => {
    expect(accuracyLevel(8)).toMatchObject({ level: 'good', label: 'Akurasi baik (±8 m)' });
    expect(accuracyLevel(60)).toMatchObject({ level: 'fair' });
    expect(accuracyLevel(450)).toMatchObject({ level: 'poor' });
  });

  it('warns that low accuracy usually means Wi-Fi/IP location instead of GPS', () => {
    expect(accuracyLevel(1200).label).toContain('±1200 m');
    expect(accuracyLevel(1200).hint).toMatch(/GPS/);
  });

  it('is unknown when the browser gave no accuracy', () => {
    expect(accuracyLevel(null)).toMatchObject({ level: 'unknown' });
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

describe('locationAdvice', () => {
  it('explains that location needs https or localhost when the page is not a secure context', () => {
    const advice = locationAdvice('insecure');
    expect(advice.text).toMatch(/https/i);
    expect(advice.text).toMatch(/localhost/i);
    expect(advice.canRetry).toBe(false);
  });

  it('explains how to re-enable a denied permission and offers a retry', () => {
    const advice = locationAdvice('denied');
    expect(advice.text).toMatch(/gembok|pengaturan situs/i);
    expect(advice.canRetry).toBe(true);
  });

  it('offers to activate location while still waiting for the browser prompt', () => {
    expect(locationAdvice('waiting').canRetry).toBe(true);
  });

  it('offers a retry when the position is temporarily unavailable', () => {
    expect(locationAdvice('unavailable').canRetry).toBe(true);
  });

  it('has nothing to say when tracking is active or off', () => {
    expect(locationAdvice('active').canRetry).toBe(false);
    expect(locationAdvice('off')).toBeNull();
  });
});
