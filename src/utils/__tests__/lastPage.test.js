import { describe, it, expect, beforeEach } from 'vitest';
import { saveLastPath, getLastPath } from '../lastPage';

describe('saveLastPath / getLastPath', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers a page and returns it', () => {
    saveLastPath('/settings');
    expect(getLastPath()).toBe('/settings');
  });

  it('does not bother saving the root path (that is already the default)', () => {
    saveLastPath('/settings');
    saveLastPath('/');
    expect(getLastPath()).toBe('/settings');
  });

  it('returns null when nothing has been remembered yet', () => {
    expect(getLastPath()).toBeNull();
  });

  it('overwrites the previously remembered page with the newest one', () => {
    saveLastPath('/history');
    saveLastPath('/customers');
    expect(getLastPath()).toBe('/customers');
  });
});
