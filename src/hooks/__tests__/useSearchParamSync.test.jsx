import { describe, it, expect, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom';
import { useSearchParamSync } from '../useSearchParamSync';

const controls = {};

const Probe = ({ initial = 'a', defaultValue = 'a', storageKey = null }) => {
  const [, setSearchParams] = useSearchParams();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    controls.setValue = setValue;
  }, []);
  useSearchParamSync(setSearchParams, 'tab', value, defaultValue, storageKey);
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
};

describe('useSearchParamSync', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderProbe = async (entry, props) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <Probe {...props} />
        </MemoryRouter>
      );
    });
  };

  const search = () => container.querySelector('output').textContent;

  it('writes a non-default value to the URL and keeps other params', async () => {
    await renderProbe('/x?q=budi', { initial: 'b', defaultValue: 'a' });
    expect(new URLSearchParams(search()).get('tab')).toBe('b');
    expect(new URLSearchParams(search()).get('q')).toBe('budi');
  });

  it('removes the param when the value equals the default', async () => {
    await renderProbe('/x?tab=b', { initial: 'a', defaultValue: 'a' });
    expect(search()).toBe('');
  });

  it('follows later state changes', async () => {
    await renderProbe('/x', { initial: 'a', defaultValue: 'a' });
    expect(search()).toBe('');

    await act(async () => { controls.setValue('c'); });
    expect(new URLSearchParams(search()).get('tab')).toBe('c');

    await act(async () => { controls.setValue('a'); });
    expect(search()).toBe('');
  });

  it('persists the value to localStorage when a storage key is given', async () => {
    await renderProbe('/x', { initial: 'z', defaultValue: 'a', storageKey: 'kasir_test_tab' });
    expect(localStorage.getItem('kasir_test_tab')).toBe('z');
  });
});
