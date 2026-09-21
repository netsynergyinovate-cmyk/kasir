import { describe, it, expect } from 'vitest';
import { parseCoordinates, googleMapsNavUrl, googleMapsRouteUrl, formatDistance, formatDuration } from '../geo';

describe('parseCoordinates', () => {
  it('parses a "lat, lng" pair', () => {
    expect(parseCoordinates('-6.2088, 106.8456')).toEqual({ lat: -6.2088, lng: 106.8456 });
    expect(parseCoordinates('-6.2088 106.8456')).toEqual({ lat: -6.2088, lng: 106.8456 });
    expect(parseCoordinates('  -6.2088,106.8456  ')).toEqual({ lat: -6.2088, lng: 106.8456 });
  });

  it('reads the @lat,lng part of a long Google Maps link', () => {
    const url = 'https://www.google.com/maps/place/Rumah/@-6.2088,106.8456,17z/data=!3m1!4b1';
    expect(parseCoordinates(url)).toEqual({ lat: -6.2088, lng: 106.8456 });
  });

  it('reads q= and ll= query parameters', () => {
    expect(parseCoordinates('https://maps.google.com/?q=-6.2,106.8')).toEqual({ lat: -6.2, lng: 106.8 });
    expect(parseCoordinates('https://maps.google.com/?ll=-7.25,112.75&z=15')).toEqual({ lat: -7.25, lng: 112.75 });
  });

  it('reads the !3d!4d pin coordinates in a place link', () => {
    const url = 'https://www.google.com/maps/place/X/data=!4m6!3m5!1s0x0:0x0!8m2!3d-6.9175!4d107.6191';
    expect(parseCoordinates(url)).toEqual({ lat: -6.9175, lng: 107.6191 });
  });

  it('rejects text without coordinates and out-of-range values', () => {
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('jalan mawar no 5')).toBeNull();
    expect(parseCoordinates('95.1, 106.8')).toBeNull();
    expect(parseCoordinates('-6.2, 190.5')).toBeNull();
    expect(parseCoordinates('https://maps.app.goo.gl/abc123')).toBeNull();
  });
});

describe('google maps urls', () => {
  it('builds a navigation url to one destination', () => {
    expect(googleMapsNavUrl({ lat: -6.2, lng: 106.8 }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=-6.2,106.8&travelmode=driving');
  });

  it('builds a multi-stop url with the last stop as destination', () => {
    const url = googleMapsRouteUrl([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }]);
    expect(url).toContain('destination=5,6');
    expect(url).toContain('waypoints=1,2%7C3,4');
  });

  it('keeps at most 9 waypoints', () => {
    const points = Array.from({ length: 15 }, (_, i) => ({ lat: i, lng: i }));
    const url = googleMapsRouteUrl(points);
    const waypoints = decodeURIComponent(new URL(url).searchParams.get('waypoints')).split('|');
    expect(waypoints).toHaveLength(9);
  });
});

describe('formatDistance / formatDuration', () => {
  it('formats meters and kilometers with a decimal comma', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(3240)).toBe('3,2 km');
  });

  it('formats seconds into minutes and hours', () => {
    expect(formatDuration(20)).toBe('kurang dari 1 menit');
    expect(formatDuration(8 * 60 + 10)).toBe('8 menit');
    expect(formatDuration(3600 + 5 * 60)).toBe('1 jam 5 menit');
    expect(formatDuration(7200)).toBe('2 jam');
  });
});
