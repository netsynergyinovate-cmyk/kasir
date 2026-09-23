import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import LocationPicker from '../LocationPicker';

describe('LocationPicker fullscreen toggle and layer switching', () => {
  it('mounts, toggles fullscreen, and switches layers without losing map container or throwing errors', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LocationPicker value={{ lat: -6.2, lng: 106.8 }} onChange={() => {}} />);
    });

    // Check that map container exists
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(container.querySelector('.leaflet-tile-pane')).not.toBeNull();

    // Find maximize button and click it
    const maxBtn = container.querySelector('button[title*="Perbesar"]');
    expect(maxBtn).not.toBeNull();

    await act(async () => {
      maxBtn.click();
    });

    // In fullscreen mode, check that map container still exists and has leaflet-pane
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(container.querySelector('.leaflet-tile-pane')).not.toBeNull();

    // Click "Peta" button to switch layer
    const streetBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Peta'));
    expect(streetBtn).not.toBeNull();

    await act(async () => {
      streetBtn.click();
    });
    expect(container.querySelector('.leaflet-container')).not.toBeNull();

    // Click "Satelit" button to switch back
    const satBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Satelit'));
    expect(satBtn).not.toBeNull();

    await act(async () => {
      satBtn.click();
    });
    expect(container.querySelector('.leaflet-container')).not.toBeNull();

    // Find "Selesai" button to minimize
    const minBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Selesai'));
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

