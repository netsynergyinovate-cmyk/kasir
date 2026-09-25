import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import MoneyInput from '../MoneyInput';

const Harness = ({ initial = '', onChange, name }) => {
  const [value, setValue] = useState(initial);
  return (
    <form>
      <MoneyInput
        value={value}
        name={name}
        prefix="Rp"
        aria-label="Nominal"
        onValueChange={(next) => { setValue(next); onChange?.(next); }}
      />
    </form>
  );
};

describe('MoneyInput', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const mount = async (props) => {
    await act(async () => { root.render(<Harness {...props} />); });
    return container.querySelector('input[aria-label="Nominal"]');
  };

  const type = async (input, raw, caret = raw.length) => {
    await act(async () => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, raw);
      input.setSelectionRange(caret, caret);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('shows thousand separators while typing and reports the plain number', async () => {
    const onChange = vi.fn();
    const input = await mount({ onChange });
    await type(input, '50000');
    expect(input.value).toBe('50.000');
    expect(onChange).toHaveBeenLastCalledWith('50000');

    await type(input, '1250000');
    expect(input.value).toBe('1.250.000');
  });

  it('ignores letters and symbols, and strips leading zeros', async () => {
    const onChange = vi.fn();
    const input = await mount({ onChange });
    await type(input, 'Rp 0012abc');
    expect(input.value).toBe('12');
    expect(onChange).toHaveBeenLastCalledWith('12');
  });

  it('formats an initial value and lets it be cleared', async () => {
    const onChange = vi.fn();
    const input = await mount({ initial: '75000', onChange });
    expect(input.value).toBe('75.000');
    await type(input, '');
    expect(input.value).toBe('');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('keeps the caret after the same digit when the separator shifts', async () => {
    const input = await mount({ initial: '999' });
    // ketik "9" di akhir: 9999 -> 9.999, kursor harus tetap di akhir (posisi 5)
    await type(input, '9999');
    expect(input.value).toBe('9.999');
    expect(input.selectionStart).toBe(5);

    // sisipkan "1" di awal: 19.999 dengan kursor sesudah angka pertama
    await type(input, '19.999', 1);
    expect(input.value).toBe('19.999');
    expect(input.selectionStart).toBe(1);
  });

  it('sends the plain number (not the formatted text) through a named hidden field', async () => {
    const input = await mount({ name: 'amountPaid' });
    await type(input, '200000');
    const hidden = container.querySelector('input[type="hidden"][name="amountPaid"]');
    expect(hidden.value).toBe('200000');
    expect(new FormData(container.querySelector('form')).get('amountPaid')).toBe('200000');
  });

  it('shows the currency prefix', async () => {
    await mount({});
    expect(container.textContent).toContain('Rp');
  });
});
