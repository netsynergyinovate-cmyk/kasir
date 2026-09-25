// Nominal rupiah pada kolom isian dipisah titik ribuan (50000 -> 50.000); nilai yang disimpan tetap angka murni.
export const MAX_MONEY_DIGITS = 12;

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

// Hanya angka, tanpa nol di depan, dibatasi MAX_MONEY_DIGITS supaya tidak melebihi rentang angka aman.
export const normalizeMoneyDigits = (value) =>
  digitsOnly(value).slice(0, MAX_MONEY_DIGITS).replace(/^0+(?=\d)/, '');

// '50000' / 50000 -> '50.000'; kosong tetap kosong.
export const formatThousands = (value) => normalizeMoneyDigits(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// '50.000' -> 50000 (0 bila kosong / tidak valid).
export const parseMoney = (value) => Number(normalizeMoneyDigits(value)) || 0;
