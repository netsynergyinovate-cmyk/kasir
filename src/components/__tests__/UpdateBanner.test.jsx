import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import UpdateBanner from '../UpdateBanner';
import { applyPendingUpdate, setApplyUpdate } from '../../utils/appUpdate';

describe('UpdateBanner', () => {
  it('is hidden until a new version is announced', () => {
    expect(renderToString(<UpdateBanner />)).toBe('');
  });
});

describe('applyPendingUpdate', () => {
  it('runs the registered updater once the service worker is ready, and reports false before that', () => {
    expect(applyPendingUpdate()).toBe(false);
    let called = 0;
    setApplyUpdate(() => { called += 1; });
    expect(applyPendingUpdate()).toBe(true);
    expect(called).toBe(1);
  });
});
