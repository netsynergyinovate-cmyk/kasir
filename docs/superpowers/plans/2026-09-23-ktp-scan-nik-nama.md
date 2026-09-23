# KTP Scan (NIK & Nama Auto-fill) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Scan KTP" modal to step 1 of the Tambah Pelanggan Runsnet wizard that captures a KTP photo (live camera or file upload), shows real-time advisory quality warnings (too bright, too dark, blurry, glare), runs OCR entirely client-side (`tesseract.js`), extracts a best-guess NIK and Nama, and lets the user review/edit before applying to the form.

**Architecture:** Two new files (`src/utils/ktpScan.js` for pure, unit-testable pixel/text analysis; `src/components/KtpScanner.jsx` for the camera/upload/OCR modal) plus a small edit to `src/pages/TambahPelangganRunsnet.jsx` to open the modal and apply its result. `tesseract.js` is a new dependency, loaded only via dynamic `import()` inside the modal at the moment OCR actually runs — never a static top-level import — so it never enters the main app bundle.

**Tech Stack:** React (hooks: `useState`, `useEffect`, `useRef`, `useCallback`), Canvas API (`getUserMedia`, `<video>`, `<canvas>`, `ImageData`), `tesseract.js` (new npm dependency), lucide-react icons, Vitest for pure-function unit tests.

## Global Constraints

- Quality checks (brightness/blur/glare) are **advisory only** — the capture button is never disabled by them.
- Only brightness, blur, and glare are checked — no document-boundary/"is a KTP actually in frame" detection (out of scope per the design spec).
- NIK extraction relies solely on finding an isolated 16-digit run; Nama extraction is best-effort text-label parsing — both are always shown as **editable** fields, never auto-applied without the user seeing them first.
- `onApply({ nik, nama })` always **overwrites** `form.nik`/`form.nama` unconditionally (no merge-only-if-empty logic) — the review step itself is the confirmation point.
- No server/API changes — this is 100% client-side; nothing about a KTP photo is ever sent to a server.
- Camera stream must always be stopped (`getTracks().forEach(t => t.stop())`) on modal close/unmount — never leave the camera light on.
- Every new/changed file must pass `npx eslint <file>` and the relevant `npx vitest run` with zero failures before moving to the next task.

---

### Task 1: `ktpScan.js` — pixel-quality analysis and NIK/Nama text extraction

**Files:**
- Create: `src/utils/ktpScan.js`
- Test: `src/utils/__tests__/ktpScan.test.js`

**Interfaces:**
- Produces: `export function analyzeFrameQuality({ data, width, height }): { brightness: 'ok'|'too-bright'|'too-dark', blur: 'ok'|'blurry', glare: 'ok'|'glare' }`. `data` is any array-like (plain Array or Uint8ClampedArray) of RGBA bytes, length `width*height*4`, row-major — i.e. shaped exactly like a Canvas `ImageData`. Consumed by Task 2's `KtpScanner.jsx` with a real `ImageData` from `canvas.getContext('2d').getImageData(...)`.
- Produces: `export function extractNikAndNama(ocrText: string): { nik: string|null, nama: string|null }`. Consumed by Task 2 with `tesseract.js`'s recognized text.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/ktpScan.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/ktpScan.test.js`
Expected: FAIL — `Cannot find module '../ktpScan'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `ktpScan.js`**

Create `src/utils/ktpScan.js`:

```javascript
// Ambang batas dipilih lewat uji manual foto KTP sungguhan (2026-09-23) — kalau di lapangan ternyata
// kurang/kelewat sensitif, sesuaikan angka-angka ini, bukan logikanya.
const BRIGHTNESS_TOO_BRIGHT = 200; // rata-rata luminance (0-255) di atas ini = kepencar cahaya
const BRIGHTNESS_TOO_DARK = 50; // di bawah ini = kegelapan
const BLUR_VARIANCE_THRESHOLD = 90; // varians respons Laplacian di bawah ini = kurang detail tepi (buram/flat)
const GLARE_PIXEL_RATIO_THRESHOLD = 0.08; // >8% piksel nyaris putih murni (>245,245,245) = ada pantulan cahaya

function toGrayscaleGrid({ data, width, height }) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return gray;
}

// Cek kualitas satu frame/foto: terang/gelap (rata-rata luminance), buram (varians Laplacian —
// gambar flat/tanpa detail tepi punya varians ~0), pantulan cahaya (rasio piksel nyaris putih murni).
// Input berbentuk sama seperti Canvas ImageData ({ data, width, height }) tapi menerima array biasa
// juga, supaya bisa diuji tanpa canvas sungguhan.
export function analyzeFrameQuality({ data, width, height }) {
  const totalPixels = width * height;
  let sumLuminance = 0;
  let brightPixels = 0;

  for (let i = 0; i < totalPixels; i += 1) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    sumLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
    if (r > 245 && g > 245 && b > 245) brightPixels += 1;
  }

  const avgLuminance = sumLuminance / totalPixels;
  const brightness = avgLuminance > BRIGHTNESS_TOO_BRIGHT ? 'too-bright' : avgLuminance < BRIGHTNESS_TOO_DARK ? 'too-dark' : 'ok';
  const glare = brightPixels / totalPixels > GLARE_PIXEL_RATIO_THRESHOLD ? 'glare' : 'ok';

  const gray = toGrayscaleGrid({ data, width, height });
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width];
      lapSum += lap;
      lapSumSq += lap * lap;
      lapCount += 1;
    }
  }
  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const lapVariance = lapCount > 0 ? lapSumSq / lapCount - lapMean * lapMean : 0;
  const blur = lapVariance < BLUR_VARIANCE_THRESHOLD ? 'blurry' : 'ok';

  return { brightness, blur, glare };
}

// NIK KTP selalu tepat 16 digit. Lookbehind/lookahead negatif (bukan \b, yang cuma cek batas
// kata-vs-bukan-kata) memastikan angka 15 atau 17 digit yang kebetulan ada di teks OCR TIDAK ikut
// kena — hanya deretan persis 16 digit yang terisolasi (diapit non-digit atau ujung teks) yang match.
const NIK_REGEX = /(?<!\d)(\d{16})(?!\d)/;

// Label "Nama" di KTP diikuti nilainya di baris yang sama (kadang ada ":" kadang tidak) atau, kalau
// OCR memecah baris label dan nilai jadi dua, di baris berikutnya. Regex longgar (case-insensitive,
// spasi bebas) karena OCR gratisan sering salah kapitalisasi/spasi.
const NAMA_LABEL_REGEX = /nama\s*[:\-]?\s*(.*)/i;

// Nebak NIK & Nama dari teks mentah hasil OCR satu foto KTP. NIK: cari 16 digit terisolasi (andal,
// gak ada nomor lain di KTP yang persis 16 digit). Nama: cari baris berlabel "nama", ambil sisa baris
// itu atau baris berikutnya kalau kosong. TIDAK dijamin selalu benar — caller WAJIB nampilin hasil ini
// sebagai draft yang bisa diedit, bukan langsung dipakai.
export function extractNikAndNama(ocrText) {
  const text = String(ocrText || '');
  const nikMatch = text.match(NIK_REGEX);
  const nik = nikMatch ? nikMatch[1] : null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let nama = null;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(NAMA_LABEL_REGEX);
    if (match) {
      const sameLine = match[1].trim();
      nama = sameLine || (lines[i + 1] ? lines[i + 1].trim() : null);
      break;
    }
  }

  return { nik, nama };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/ktpScan.test.js`
Expected: PASS, all 11 tests green.

- [ ] **Step 5: Lint**

Run: `npx eslint src/utils/ktpScan.js src/utils/__tests__/ktpScan.test.js`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/utils/ktpScan.js src/utils/__tests__/ktpScan.test.js
git commit -m "feat: add pixel-quality and NIK/Nama extraction helpers for KTP scanning"
```

---

### Task 2: `KtpScanner.jsx` — camera/upload modal with live quality badges and OCR

**Files:**
- Create: `src/components/KtpScanner.jsx`
- Modify: `package.json` (add `tesseract.js` dependency)

**Interfaces:**
- Consumes: `analyzeFrameQuality`, `extractNikAndNama` from `../utils/ktpScan` (Task 1).
- Produces: `export default function KtpScanner({ onApply, onClose })`. `onApply` is called with `{ nik: string, nama: string }` (both already `.trim()`-ed) when the user presses "Terapkan ke Form". `onClose` is called whenever the modal should close (X button, Batal — there's no separate Batal button, closing is always via the X). Consumed by Task 3's `TambahPelangganRunsnet.jsx`.

- [ ] **Step 1: Install the dependency**

Run: `npm install tesseract.js`
Expected: `package.json` and `package-lock.json` (or `pnpm-lock.yaml`/`yarn.lock`, whichever this repo uses — check which lockfile already exists before running) gain a `tesseract.js` entry. Verify with: `cat package.json | grep tesseract` (or open the file) — should show a `"tesseract.js": "^..."` line under `dependencies`.

- [ ] **Step 2: Write the component**

Create `src/components/KtpScanner.jsx`:

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, X, Loader2, AlertTriangle, Check } from 'lucide-react';
import { analyzeFrameQuality, extractNikAndNama } from '../utils/ktpScan';

const QUALITY_CHECK_INTERVAL_MS = 300;
const SCAN_CANVAS_WIDTH = 320; // downscale sebelum analisis kualitas & OCR biar cepat di HP

const QUALITY_MESSAGES = {
  'too-bright': 'Terlalu terang — kurangi cahaya atau jauhkan dari sumber cahaya langsung.',
  'too-dark': 'Terlalu gelap — cari tempat lebih terang.',
  blurry: 'Gambar buram — tahan HP lebih stabil, jangan terlalu dekat.',
  glare: 'Ada pantulan cahaya di KTP — miringkan sedikit biar pantulannya hilang.',
};

const QUALITY_KEY_ORDER = ['brightness', 'blur', 'glare'];

function warningsFromQuality(quality) {
  return QUALITY_KEY_ORDER
    .map((key) => quality[key])
    .filter((value) => value !== 'ok')
    .map((value) => QUALITY_MESSAGES[value]);
}

// Modal scan KTP: kamera live (dengan peringatan kualitas real-time, TIDAK mengunci tombol jepret —
// kondisi lapangan gak selalu ideal) atau upload file, lalu OCR sepenuhnya di browser (tesseract.js,
// dimuat baru pas dipakai) buat nebak NIK & Nama. Hasil WAJIB direview manual (kotak yang bisa
// diedit) sebelum "Terapkan ke Form" — OCR gratis begini gampang salah baca, terutama Nama.
const KtpScanner = ({ onApply, onClose }) => {
  const [tab, setTab] = useState('camera');
  const [cameraError, setCameraError] = useState(null);
  const [qualityWarnings, setQualityWarnings] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null); // data URL
  const [ocrStatus, setOcrStatus] = useState('idle'); // idle | running | done | error
  const [ocrError, setOcrError] = useState(null);
  const [reviewNik, setReviewNik] = useState('');
  const [reviewNama, setReviewNama] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (tab !== 'camera' || capturedImage) {
      stopCamera();
      return undefined;
    }
    let cancelled = false;
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak didukung browser ini. Coba pakai Upload File.');
      setTab('upload');
      return undefined;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        intervalRef.current = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.videoWidth === 0) return;
          const scale = SCAN_CANVAS_WIDTH / video.videoWidth;
          canvas.width = SCAN_CANVAS_WIDTH;
          canvas.height = Math.round(video.videoHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setQualityWarnings(warningsFromQuality(analyzeFrameQuality(imageData)));
        }, QUALITY_CHECK_INTERVAL_MS);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('Kamera tidak bisa diakses (izin ditolak?). Coba pakai Upload File.');
          setTab('upload');
        }
      });

    return () => { cancelled = true; stopCamera(); };
  }, [tab, capturedImage, stopCamera]);

  const handleCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const scale = SCAN_CANVAS_WIDTH / img.width;
        canvas.width = SCAN_CANVAS_WIDTH;
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setQualityWarnings(warningsFromQuality(analyzeFrameQuality(imageData)));
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const runOcr = useCallback(async (imageDataUrl) => {
    setOcrStatus('running');
    setOcrError(null);
    try {
      const Tesseract = await import('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(imageDataUrl, 'eng');
      const { nik, nama } = extractNikAndNama(text);
      setReviewNik(nik || '');
      setReviewNama(nama || '');
      setOcrStatus('done');
    } catch (err) {
      setOcrError(`OCR gagal jalan (${err.message}). Isi NIK/Nama manual di form.`);
      setOcrStatus('error');
    }
  }, []);

  useEffect(() => {
    if (capturedImage) runOcr(capturedImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedImage]);

  const retake = () => {
    setCapturedImage(null);
    setOcrStatus('idle');
    setOcrError(null);
    setReviewNik('');
    setReviewNama('');
    setQualityWarnings([]);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const apply = () => {
    onApply({ nik: reviewNik.trim(), nama: reviewNama.trim() });
    handleClose();
  };

  const warningList = (
    <div className="space-y-1">
      {qualityWarnings.map((w) => (
        <p key={w} className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <AlertTriangle size={13} className="shrink-0" /> {w}
        </p>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4 relative max-h-[92vh] overflow-y-auto">
        <button type="button" onClick={handleClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
          <X size={18} />
        </button>
        <h3 className="text-lg font-black text-gray-900">Scan KTP</h3>

        {!capturedImage && (
          <>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button type="button" onClick={() => setTab('camera')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${tab === 'camera' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                <Camera size={14} /> Kamera
              </button>
              <button type="button" onClick={() => setTab('upload')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${tab === 'upload' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                <Upload size={14} /> Upload File
              </button>
            </div>

            {tab === 'camera' ? (
              <div className="space-y-2">
                {cameraError && <p className="text-xs font-bold text-red-600">{cameraError}</p>}
                <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                </div>
                {qualityWarnings.length > 0 && warningList}
                <button type="button" onClick={handleCapture} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Camera size={18} /> Jepret
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-xs" />
                {qualityWarnings.length > 0 && warningList}
              </div>
            )}
          </>
        )}

        {capturedImage && (
          <div className="space-y-3">
            <img src={capturedImage} alt="KTP" className="w-full rounded-xl border border-gray-200" />
            {qualityWarnings.length > 0 && warningList}

            {ocrStatus === 'running' && (
              <p className="text-xs font-bold text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Membaca KTP...</p>
            )}
            {ocrStatus === 'error' && (
              <p className="text-xs font-bold text-red-600">{ocrError}</p>
            )}
            {ocrStatus === 'done' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Hasil baca — cek &amp; koreksi dulu sebelum diterapkan</p>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">NIK</label>
                  <input
                    value={reviewNik}
                    onChange={(e) => setReviewNik(e.target.value.replace(/[^0-9]/g, ''))}
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    placeholder="Gak kebaca otomatis, isi manual"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama</label>
                  <input
                    value={reviewNama}
                    onChange={(e) => setReviewNama(e.target.value)}
                    type="text"
                    placeholder="Gak kebaca otomatis, isi manual"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={retake} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl active:scale-95 transition-all">
                Foto Ulang
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={ocrStatus !== 'done'}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check size={18} /> Terapkan ke Form
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default KtpScanner;
```

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/KtpScanner.jsx`
Expected: no output (clean). If it flags the `useEffect` on `[capturedImage]` for missing `runOcr` in deps, confirm the `// eslint-disable-next-line react-hooks/exhaustive-deps` line is present immediately above that dependency array (it's included in the code above) — this matches the existing pattern already used in `src/pages/TambahPelangganRunsnet.jsx`'s own options-loading effect and `src/components/LocationPicker.jsx`.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: unaffected — same pass count as after Task 1 (this component has no automated tests per the design spec; camera/OCR need real hardware). Confirm no existing test broke from the `tesseract.js` install (it shouldn't — nothing imports it statically).

- [ ] **Step 5: Manual smoke check in dev**

Run: `npm run dev`, temporarily render `<KtpScanner onApply={(v) => console.log(v)} onClose={() => console.log('closed')} />` from any page you can reach easily (or wait for Task 3's real integration and test through there instead — either is fine, this step just confirms the component itself renders without crashing before wiring it into the wizard). Confirm: modal opens, Kamera tab requests camera permission, quality badges appear/disappear as you point the camera at different things (e.g. covering the lens → too-dark; pointing at a bright light → too-bright), Jepret captures a still frame, OCR runs and shows a progress spinner, review boxes appear with whatever text was found (or empty with the placeholder hint), Foto Ulang resets back to the camera view, X closes and stops the camera (check the browser's camera-in-use indicator turns off).

- [ ] **Step 6: Commit**

```bash
git add src/components/KtpScanner.jsx package.json package-lock.json
git commit -m "feat: add KtpScanner modal (camera/upload capture, live quality badges, client-side OCR)"
```

(Adjust the lockfile filename in the `git add` if this repo uses `pnpm-lock.yaml` or `yarn.lock` instead of `package-lock.json` — check which one Step 1 actually modified.)

---

### Task 3: Wire "Scan KTP" into the wizard's step 1

**Files:**
- Modify: `src/pages/TambahPelangganRunsnet.jsx`

**Interfaces:**
- Consumes: `KtpScanner` default export from `../components/KtpScanner` (Task 2), called as `<KtpScanner onApply={handleKtpApply} onClose={() => setShowKtpScanner(false)} />`.

- [ ] **Step 1: Add the import**

In `src/pages/TambahPelangganRunsnet.jsx`, add this import alongside the existing ones near the top of the file (after the `LocationPicker` import):

```jsx
import LocationPicker from '../components/LocationPicker';
import KtpScanner from '../components/KtpScanner';
```

- [ ] **Step 2: Add state and the apply handler**

Find the `startNewRegistration` function (it resets `successInfo`, `result`, `form`, `coordValue`, `biayaAuto`, `touched`, `step`). Immediately after its closing `};`, add:

```jsx
  const [showKtpScanner, setShowKtpScanner] = useState(false);

  const handleKtpApply = ({ nik, nama }) => {
    setForm((f) => ({ ...f, nik, nama }));
  };
```

- [ ] **Step 3: Add the "Scan KTP" button above the Nama field**

Find this exact block inside the `step === 1` section (it's the Jenis buttons closing followed by the Nama Pelanggan field):

```jsx
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pelanggan *</label>
              <input
                value={form.nama}
                onChange={set('nama')}
                onBlur={markTouched('nama')}
                type="text"
                placeholder="Nama lengkap"
                className={fieldClass('nama', !form.nama.trim())}
              />
            </div>
```

Replace it with (adds the Scan KTP button between the two, everything else identical):

```jsx
            </div>

            <button
              type="button"
              onClick={() => setShowKtpScanner(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-sm font-black rounded-xl active:scale-95 transition-all"
            >
              Scan KTP (isi NIK &amp; Nama otomatis)
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pelanggan *</label>
              <input
                value={form.nama}
                onChange={set('nama')}
                onBlur={markTouched('nama')}
                type="text"
                placeholder="Nama lengkap"
                className={fieldClass('nama', !form.nama.trim())}
              />
            </div>
```

- [ ] **Step 4: Render the modal conditionally**

Find this exact block at the very end of the file (the closing of the fixed bottom-nav `<div>`, the closing of the outermost page `<div>`, and the end of the component):

```jsx
      </div>
    </div>
  );
};

export default TambahPelangganRunsnet;
```

Replace it with (inserts the conditional modal render as a sibling of the fixed bottom-nav `<div>`, inside the outermost page `<div>` — reachable regardless of which step or success state is showing):

```jsx
      </div>

      {showKtpScanner && (
        <KtpScanner onApply={handleKtpApply} onClose={() => setShowKtpScanner(false)} />
      )}
    </div>
  );
};

export default TambahPelangganRunsnet;
```

- [ ] **Step 5: Lint**

Run: `npx eslint src/pages/TambahPelangganRunsnet.jsx`
Expected: no output (clean).

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, same count as before this task (no new automated tests added here — this is a small wiring change into a component that already has no interactive tests per its existing smoke test in `src/pages/__tests__/TambahPelangganRunsnet.test.jsx`, which only checks static step-1 rendering and doesn't click buttons).

- [ ] **Step 7: Manual smoke check in dev**

Run: `npm run dev`, open Tambah Pelanggan Runsnet, on step 1 confirm the "Scan KTP" button appears above Nama Pelanggan, opens the modal, and that pressing "Terapkan ke Form" after a scan fills the NIK and Nama Pelanggan fields on the page behind the modal (visible once the modal closes). Confirm "Foto Ulang" and the X close button both work from within the wizard context too (not just standalone).

- [ ] **Step 8: Commit**

```bash
git add src/pages/TambahPelangganRunsnet.jsx
git commit -m "feat: wire Scan KTP into the Tambah Pelanggan Runsnet wizard's step 1"
```
