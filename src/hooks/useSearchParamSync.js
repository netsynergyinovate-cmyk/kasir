import { useEffect, useRef } from 'react';

// Menyinkronkan satu nilai state ke query string URL (dan opsional ke localStorage) tanpa
// menyentuh parameter lain. Nilai yang sama dengan defaultValue dihapus dari URL agar tetap bersih.
// `setSearchParams` dari react-router berganti identitas setiap query berubah, jadi disimpan di ref
// agar effect hanya berjalan saat nilainya sendiri berubah.
export function useSearchParamSync(setSearchParams, key, value, defaultValue = '', storageKey = null) {
  const setSearchParamsRef = useRef(setSearchParams);

  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  });

  useEffect(() => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, String(value)); } catch { /* localStorage bisa diblokir */ }
    }

    const hasValue = value !== null && value !== undefined && String(value) !== '';
    const targetVal = hasValue && String(value) !== String(defaultValue) ? String(value) : '';

    setSearchParamsRef.current((prev) => {
      const currentVal = prev.get(key) || '';
      if (currentVal === targetVal) return prev;

      const next = new URLSearchParams(prev);
      if (!targetVal) next.delete(key);
      else next.set(key, targetVal);
      return next;
    }, { replace: true });
  }, [key, value, defaultValue, storageKey]);
}
