import { describe, it, expect } from 'vitest';
import { analyzeFrameQuality, extractNikAndNama } from '../ktpScan';

// Bikin objek mirip ImageData (row-major RGBA) dari fungsi warna per-piksel, biar test gak nulis
// array angka manual.
function makeImageData(width, height, pixelFn) {
  const data = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelFn(x, y);
      data.push(r, g, b, 255);
    }
  }
  return { data, width, height };
}

describe('analyzeFrameQuality', () => {
  it('flags a uniformly bright white image as too-bright, blurry (flat), and glare', () => {
    const img = makeImageData(10, 10, () => [255, 255, 255]);
    const result = analyzeFrameQuality(img);
    expect(result.brightness).toBe('too-bright');
    expect(result.blur).toBe('blurry');
    expect(result.glare).toBe('glare');
  });

  it('flags a uniformly black image as too-dark, blurry (flat), and no glare', () => {
    const img = makeImageData(10, 10, () => [0, 0, 0]);
    const result = analyzeFrameQuality(img);
    expect(result.brightness).toBe('too-dark');
    expect(result.blur).toBe('blurry');
    expect(result.glare).toBe('ok');
  });

  it('flags a uniform mid-gray image as ok brightness but still blurry (flat has no edge detail)', () => {
    const img = makeImageData(10, 10, () => [128, 128, 128]);
    const result = analyzeFrameQuality(img);
    expect(result.brightness).toBe('ok');
    expect(result.blur).toBe('blurry');
    expect(result.glare).toBe('ok');
  });

  it('treats a high-contrast checkerboard as sharp, ok brightness, ok glare', () => {
    const img = makeImageData(10, 10, (x, y) => {
      const v = (x + y) % 2 === 0 ? 100 : 200;
      return [v, v, v];
    });
    const result = analyzeFrameQuality(img);
    expect(result.brightness).toBe('ok');
    expect(result.blur).toBe('ok');
    expect(result.glare).toBe('ok');
  });

  it('flags a localized bright cluster (20% of pixels near-white) as glare, brightness still ok', () => {
    const img = makeImageData(10, 10, (x, y) => (y < 2 ? [255, 255, 255] : [128, 128, 128]));
    const result = analyzeFrameQuality(img);
    expect(result.glare).toBe('glare');
    expect(result.brightness).toBe('ok');
  });
});

describe('extractNikAndNama', () => {
  it('extracts both NIK and Nama from clean OCR-like text', () => {
    const text = 'PROVINSI SUMATERA BARAT\nNIK: 1234567890123456\nNama : BUDI SANTOSO\nTempat/Tgl Lahir: PADANG';
    expect(extractNikAndNama(text)).toEqual({ nik: '1234567890123456', nama: 'BUDI SANTOSO' });
  });

  it('returns a null nama when no "nama" line is found, even with a valid NIK', () => {
    const text = 'NIK: 1234567890123456\nTempat Lahir: JAKARTA';
    expect(extractNikAndNama(text)).toEqual({ nik: '1234567890123456', nama: null });
  });

  it('returns both null when neither is present', () => {
    const text = 'some random unrelated ocr garbage text without digits or a name label';
    expect(extractNikAndNama(text)).toEqual({ nik: null, nama: null });
  });

  it('finds Nama even with noisy lowercase label and irregular spacing', () => {
    const text = 'nik palsu 1234567890123456 bukan nik\nnama:  SITI AMINAH';
    expect(extractNikAndNama(text)).toEqual({ nik: '1234567890123456', nama: 'SITI AMINAH' });
  });

  it('ignores 15-digit and 17-digit decoy runs, matching only the true 16-digit NIK', () => {
    const text = 'Nomor lain 123456789012345 dan 12345678901234567 tidak boleh kena\nNIK asli: 9876543210123456 selesai';
    expect(extractNikAndNama(text).nik).toBe('9876543210123456');
  });

  it('handles empty/null input without throwing', () => {
    expect(extractNikAndNama('')).toEqual({ nik: null, nama: null });
    expect(extractNikAndNama(null)).toEqual({ nik: null, nama: null });
  });
});
