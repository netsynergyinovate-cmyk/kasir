import { describe, it, expect } from 'vitest';
import { findIdleSessions, IDLE_MS } from '../../scripts/work-reminder/idle.js';

const now = Date.parse('2026-11-24T12:00:00Z');
const ago = (minutes, from = now) => new Date(from - minutes * 60000).toISOString();
const log = (session, event, minutes, from = now) => ({ session_id: session, admin_id: 'a1', admin_name: 'Wahyu', event, created_at: ago(minutes, from) });

describe('findIdleSessions', () => {
  it('uses a 1 hour threshold', () => {
    expect(IDLE_MS).toBe(3600000);
  });

  it('flags an unfinished session idle for an hour, only once', () => {
    const logs = [log('s1', 'mulai', 90), log('s1', 'berangkat', 70)];
    expect(findIdleSessions({ logs, now }).map((s) => s.sessionId)).toEqual(['s1']);
    expect(findIdleSessions({ logs: [...logs, log('s1', 'pengingat', 5)], now })).toEqual([]);
  });

  it('ignores finished sessions, recent activity and a recent app heartbeat', () => {
    expect(findIdleSessions({ logs: [log('s1', 'mulai', 90), log('s1', 'selesai', 80)], now })).toEqual([]);
    expect(findIdleSessions({ logs: [log('s1', 'mulai', 30)], now })).toEqual([]);
    expect(findIdleSessions({ logs: [log('s1', 'mulai', 90)], locations: [{ admin_id: 'a1', updated_at: ago(10) }], now })).toEqual([]);
  });

  it('reminds again after new activity followed by another idle hour', () => {
    const logs = [log('old', 'mulai', 300), log('new', 'mulai', 100), log('new', 'pengingat', 30)];
    expect(findIdleSessions({ logs, now })).toEqual([]);
    const later = now + 2 * 3600000;
    expect(findIdleSessions({ logs: [...logs, log('new', 'tiba', 70, later)], now: later }).map((s) => s.sessionId)).toEqual(['new']);
  });
});
