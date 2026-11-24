import { describe, it, expect, beforeEach } from 'vitest';
import { pickNextTarget, hasArrived, isPaymentLocked, readWork, writeWork, isWorkDay } from '../startOnWork';

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
  const monday = new Date(2026, 10, 23);
  it('allows every day until superadmin sets work days', () => {
    expect(isWorkDay(null, monday)).toBe(true);
    expect(isWorkDay({ paths: ['/'] }, monday)).toBe(true);
  });

  it('follows the configured work days (0 = Sunday)', () => {
    expect(isWorkDay({ work_days: [1, 2] }, monday)).toBe(true);
    expect(isWorkDay({ work_days: [0, 6] }, monday)).toBe(false);
  });
});
