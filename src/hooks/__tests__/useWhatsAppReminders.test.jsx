import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useWhatsAppReminders } from '../useWhatsAppReminders';

const controls = {};

const Probe = ({ companyInfo = {}, session = null }) => {
  const state = useWhatsAppReminders({ companyInfo, session });
  useEffect(() => {
    controls.state = state;
  });
  return (
    <output data-testid="feedback">{state.reminderFeedback ? `${state.reminderFeedback.type}:${state.reminderFeedback.message}` : ''}</output>
  );
};

describe('useWhatsAppReminders', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderProbe = async (props) => {
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe {...props} />);
    });
  };

  const cust = { id: 'c1', name: 'Ani', phone: '0812345678', dueDiff: 1 };

  it('sends via Watbiz API and reports success when it is enabled and configured', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    await renderProbe({ companyInfo: { watbizEnabled: true, watbizToken: 'tok' } });

    await act(async () => {
      await controls.state.sendSingleReminder(cust);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/watbiz', expect.objectContaining({ method: 'POST' }));
    expect(container.querySelector('output').textContent).toContain('success:');
    expect(controls.state.sendingReminderId).toBeNull();
  });

  it('falls back to opening wa.me when Watbiz is disabled', async () => {
    const openMock = vi.fn();
    vi.stubGlobal('open', openMock);
    await renderProbe({ companyInfo: { watbizEnabled: false } });

    await act(async () => {
      await controls.state.sendSingleReminder(cust);
    });

    expect(openMock).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/62812345678'), '_blank');
    expect(container.querySelector('output').textContent).toContain('info:');
  });

  it('falls back to wa.me when the Watbiz API call fails', async () => {
    const openMock = vi.fn();
    vi.stubGlobal('open', openMock);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await renderProbe({ companyInfo: { watbizEnabled: true, watbizToken: 'tok' } });

    await act(async () => {
      await controls.state.sendSingleReminder(cust);
    });

    expect(openMock).toHaveBeenCalled();
  });

  it('rejects a customer without a phone number without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', vi.fn());
    await renderProbe({ companyInfo: { watbizEnabled: true, watbizToken: 'tok' } });

    await act(async () => {
      await controls.state.sendSingleReminder({ id: 'c2', name: 'Budi', phone: '' });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Pelanggan Budi tidak memiliki nomor WhatsApp.');
  });

  it('sends a batch only after confirmation, to every target with a phone number', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, success: 2, failed: 0, total: 2 }) }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => false));
    await renderProbe({ companyInfo: { watbizEnabled: true, watbizToken: 'tok' } });

    const list = [cust, { id: 'c3', name: 'Citra', phone: '' }];

    await act(async () => {
      await controls.state.sendBatchReminders(list);
    });
    expect(fetchMock).not.toHaveBeenCalled(); // cancelled

    window.confirm.mockReturnValue(true);
    await act(async () => {
      await controls.state.sendBatchReminders(list);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.customers).toHaveLength(1); // hanya yang punya nomor WA
    expect(container.querySelector('output').textContent).toContain('success:');
  });

  it('does nothing and warns when no target in the batch has a phone number', async () => {
    vi.stubGlobal('alert', vi.fn());
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await renderProbe({ companyInfo: { watbizEnabled: true, watbizToken: 'tok' } });

    await act(async () => {
      await controls.state.sendBatchReminders([{ id: 'c4', name: 'Dedi', phone: '' }]);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Tidak ada pelanggan di daftar ini yang memiliki nomor WhatsApp.');
  });
});
