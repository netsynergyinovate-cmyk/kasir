import { useLayoutEffect, useRef } from 'react';
import { digitsOnly, formatThousands, normalizeMoneyDigits } from '../utils/money';

// Kolom nominal rupiah: tampil dengan titik ribuan saat mengetik (50.000), tetapi nilai yang dikirim ke
// `onValueChange` selalu string angka murni ('50000'). Jika `name` diisi, angka murni ikut terkirim lewat
// input tersembunyi sehingga FormData tidak menerima teks berformat.
const MoneyInput = ({
  value,
  onValueChange,
  name,
  prefix = null,
  className = '',
  wrapperClassName = '',
  ...rest
}) => {
  const inputRef = useRef(null);
  const digitsBeforeCaret = useRef(null);
  const digits = normalizeMoneyDigits(value);

  const handleChange = (event) => {
    const { value: raw, selectionStart } = event.target;
    const caret = selectionStart ?? raw.length;
    const nextDigits = normalizeMoneyDigits(raw);
    digitsBeforeCaret.current = Math.min(digitsOnly(raw.slice(0, caret)).length, nextDigits.length);
    onValueChange?.(nextDigits);
  };

  // Setelah format ulang, kembalikan kursor ke posisi angka yang sama supaya mengedit di tengah tidak melompat.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const target = digitsBeforeCaret.current;
    digitsBeforeCaret.current = null;
    if (target === null || !el || document.activeElement !== el) return;

    let seen = 0;
    let position = 0;
    while (position < el.value.length && seen < target) {
      if (/\d/.test(el.value[position])) seen += 1;
      position += 1;
    }
    el.setSelectionRange(position, position);
  });

  const input = (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatThousands(digits)}
      onChange={handleChange}
      className={`${className} ${prefix ? 'pl-11' : ''}`.trim()}
    />
  );

  return (
    <>
      {name && <input type="hidden" name={name} value={digits} />}
      {prefix ? (
        <span className={`relative block ${wrapperClassName}`.trim()}>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">{prefix}</span>
          {input}
        </span>
      ) : input}
    </>
  );
};

export default MoneyInput;
