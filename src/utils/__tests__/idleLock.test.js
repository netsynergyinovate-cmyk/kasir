import { describe, it, expect } from 'vitest';
import { IDLE_LIMIT_MS, remainingMs, isExpired, formatCountdown, countdownTone } from '../idleLock';

describe('idle lock timing', () => {
  it('uses a 15 minute limit', () => {
    expect(IDLE_LIMIT_MS).toBe(15 * 60 * 1000);
  });

  it('counts down from the last activity and never goes negative', () => {
    expect(remainingMs(1000, 1000)).toBe(IDLE_LIMIT_MS);
    expect(remainingMs(1000, 1000 + 60000)).toBe(IDLE_LIMIT_MS - 60000);
    expect(remainingMs(1000, 1000 + IDLE_LIMIT_MS + 5000)).toBe(0);
  });

  it('is expired exactly when the limit has passed', () => {
    expect(isExpired(0, IDLE_LIMIT_MS - 1)).toBe(false);
    expect(isExpired(0, IDLE_LIMIT_MS)).toBe(true);
  });
});

describe('formatCountdown', () => {
  it('formats milliseconds as MM:SS, rounding partial seconds up', () => {
    expect(formatCountdown(15 * 60 * 1000)).toBe('15:00');
    expect(formatCountdown(872000)).toBe('14:32');
    expect(formatCountdown(59500)).toBe('01:00');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
  });
});

describe('countdownTone', () => {
  it('escalates as the lock gets close', () => {
    expect(countdownTone(5 * 60 * 1000)).toBe('normal');
    expect(countdownTone(60 * 1000)).toBe('warning');
    expect(countdownTone(30 * 1000)).toBe('critical');
    expect(countdownTone(0)).toBe('critical');
  });
});
