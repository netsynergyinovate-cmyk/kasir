import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import RouteMap from '../RouteMap';

describe('RouteMap fullscreen toggle and rendering', () => {
  it('mounts, toggles fullscreen, and unmounts without crashing or losing map instance', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const stops = [
      { id: 's1', lat: -6.2, lng: 106.8, number: 1, tone: 'ok', title: 'Customer 1' },
      { id: 's2', lat: -6.21, lng: 106.81, number: 2, tone: 'info', title: 'Customer 2' }
    ];

    await act(async () => {
      root.render(<RouteMap stops={stops} />);
    });

    // Check that map container exists
    expect(container.querySelector('.leaflet-container')).not.toBeNull();

    // Find maximize button and click it
    const maxBtn = container.querySelector('button[title*="Perbesar"]');
    expect(maxBtn).not.toBeNull();

    await act(async () => {
      maxBtn.click();
    });

    // In fullscreen mode, check that map container still exists and has leaflet-pane
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(container.querySelector('.leaflet-tile-pane')).not.toBeNull();

    // Find minimize button and click it
    const minBtn = container.querySelector('button[title*="Kecilkan"]');
    expect(minBtn).not.toBeNull();

    await act(async () => {
      minBtn.click();
    });

    // After minimize, map must NOT crash and must retain leaflet elements
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(container.querySelector('.leaflet-tile-pane')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
