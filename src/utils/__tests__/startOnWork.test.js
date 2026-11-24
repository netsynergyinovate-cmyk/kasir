import { describe, it, expect, beforeEach } from 'vitest';
import { pickNextTarget, hasArrived, isPaymentLocked, readWork, writeWork, isWorkDay, describeWorkRange } from '../startOnWork';

const a = { id: 'a', lat: -6.2, lng: 106.8 };
const b = { id: 'b', lat: -6.21, lng: 106.81 };
const far = { id: 'far', lat: -6.5, lng: 107 };
const noCoords = { id: 'x', lat: null, lng: null };

describe('pickNextTarget', () => {
  it('follows route order and skips done or coordinate-less stops', () => {
    expect(pickNextTarget({ routeStops: [noCoords, a, b], doneIds: ['a'] })).toBe(b);
  });

  it('falls back to the nearest other stop when the route is exhausted', () => {
    expect(pickNextTarget({ routeStops: [a], otherStops: [far, b], position: { lat: -6.21, lng: 106.81 }, doneIds: ['a'] })).toBe(b);
  });

  it('returns null when nothing is left', () => {
    expect(pickNextTarget({ routeStops: [a], doneIds: ['a'] })).toBeNull();
  });
});

describe('hasArrived', () => {
  it('is true within 50 m and false farther away', () => {
    expect(hasArrived({ lat: -6.2002, lng: 106.8 }, a)).toBe(true);
    expect(hasArrived({ lat: -6.201, lng: 106.8 }, a)).toBe(false);
    expect(hasArrived(null, a)).toBe(false);
  });
});

describe('work storage', () => {
  beforeEach(() => localStorage.clear());

  it('only returns the work session of the same user and locks payment after arrival', () => {
    writeWork({ userId: 'u1', sessionId: 's', arrivedId: 'a' });
    expect(readWork('u2')).toBeNull();
    expect(isPaymentLocked(readWork('u1'))).toBe(true);
    writeWork(null);
    expect(readWork('u1')).toBeNull();
    expect(isPaymentLocked(null)).toBe(false);
  });
});

describe('isWorkDay', () => {
  const day = new Date(2026, 10, 23, 15, 0);
  it('allows every day until superadmin sets a date range', () => {
    expect(isWorkDay(null, day)).toBe(true);
    expect(isWorkDay({ paths: ['/'] }, day)).toBe(true);
  });

  it('follows the configured date range, inclusive, with optional ends', () => {
    expect(isWorkDay({ work_range: { from: '2026-11-23', to: '2026-11-23' } }, day)).toBe(true);
    expect(isWorkDay({ work_range: { from: '2026-11-24', to: '2026-11-30' } }, day)).toBe(false);
    expect(isWorkDay({ work_range: { from: null, to: '2026-11-22' } }, day)).toBe(false);
    expect(isWorkDay({ work_range: { from: '2026-11-01', to: null } }, day)).toBe(true);
  });

  it('describes the range', () => {
    expect(describeWorkRange(null)).toBe('Setiap hari');
    expect(describeWorkRange({ from: '2026-12-01', to: '2026-12-15' })).toBe('1 Des – 15 Des');
  });
});
