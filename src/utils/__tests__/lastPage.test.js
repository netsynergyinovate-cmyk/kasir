import { describe, it, expect, beforeEach } from 'vitest';
import { saveLastPath, getLastPath } from '../lastPage';

describe('saveLastPath / getLastPath', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('remembers a page and returns it', () => {
    saveLastPath('/settings');
    expect(getLastPath()).toBe('/settings');
  });

  it('remembers full path with query parameters and hash anchors', () => {
    saveLastPath('/customers?tab=isolir&view=grid#active');
    expect(getLastPath()).toBe('/customers?tab=isolir&view=grid#active');
  });

  it('can save and remember root path', () => {
    saveLastPath('/settings');
    saveLastPath('/');
    expect(getLastPath()).toBe('/');
  });

  it('returns null when nothing has been remembered yet', () => {
    expect(getLastPath()).toBeNull();
  });

  it('overwrites the previously remembered page with the newest one', () => {
    saveLastPath('/history?tab=kasbon');
    saveLastPath('/customers?tab=belum_bayar');
    expect(getLastPath()).toBe('/customers?tab=belum_bayar');
  });

  it('only survives a refresh, not closing the app (sessionStorage, not localStorage)', () => {
    saveLastPath('/customers');
    expect(localStorage.length).toBe(0);
    sessionStorage.clear(); // aplikasi ditutup
    expect(getLastPath()).toBeNull();
  });
});
