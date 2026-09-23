# Design Spec: Scan KTP untuk Isi Otomatis NIK & Nama

**Date:** 2026-09-23
**Status:** Approved
**Topic:** Camera/file capture of a KTP (Indonesian ID card) photo, with live capture-quality guidance and client-side OCR to auto-fill the NIK and Nama fields on the "Tambah Pelanggan Runsnet" wizard's step 1.

## 1. Overview

Step 1 of the Tambah Pelanggan Runsnet wizard (`src/pages/TambahPelangganRunsnet.jsx`) has manual NIK and Nama Pelanggan text inputs. This adds a "Scan KTP" entry point above those fields that opens a modal to capture a KTP photo (live camera or file upload), gives real-time advisory feedback on photo quality (too bright, too dark, blurry, glare), runs OCR entirely client-side, and extracts a best-guess NIK and Nama for the user to review and edit before applying to the form. Nothing is sent to any server for this — OCR runs in the browser.

## 2. Scope & Expectations

- **NIK extraction is reliable**: a KTP's NIK is the only 16-consecutive-digit number on the card, so a regex match is high-confidence.
- **Nama extraction is best-effort, not guaranteed**: free client-side OCR on a real-world phone photo (hologram background, varying lighting) will misread characters sometimes. The UI must present it as an editable suggestion, never auto-apply without review.
- **Quality checks are advisory, not blocking**: the capture button is never disabled by a quality warning — field conditions (e.g. bright outdoor light) aren't always controllable, and blocking capture would be more frustrating than a bad-but-usable photo warning.
- **Out of scope**: detecting whether a KTP is actually present/framed correctly (document boundary detection) — that needs real computer-vision tooling (e.g. OpenCV.js) disproportionate to this feature's value here. Only brightness, blur, and glare are checked, matching exactly what was asked for.
- **Out of scope**: server-side/cloud OCR (Google/Azure Vision) — explicitly rejected in favor of free, offline-capable `tesseract.js`.

## 3. Components & Files

- **Create** `src/utils/ktpScan.js` — pure functions, no DOM/browser API dependency beyond plain data structures, so they're unit-testable in Vitest without a real camera or canvas:
  - `analyzeFrameQuality({ data, width, height })` → `{ brightness: 'ok' | 'too-bright' | 'too-dark', blur: 'ok' | 'blurry', glare: 'ok' | 'glare' }`. Input matches the shape of a Canvas `ImageData` (a plain object with a `Uint8ClampedArray`-like `data` field works fine — the function only indexes into it, so tests can pass a plain array).
  - `extractNikAndNama(ocrText)` → `{ nik: string | null, nama: string | null }`.
- **Create** `src/components/KtpScanner.jsx` — the modal component: camera/upload tabs, live quality badges, capture, OCR trigger + progress, review/edit box, "Terapkan ke Form" / "Batal" actions. Owns all `getUserMedia`, `<canvas>`, and `tesseract.js` usage; the wizard page never touches those directly.
- **Modify** `src/pages/TambahPelangganRunsnet.jsx` — add a "Scan KTP" button above the NIK/Nama fields in step 1, `showScanner` boolean state, and an `onApply({ nik, nama })` callback that merges into `form` (only overwriting fields the user didn't already have filled in, or simply setting both — see open question resolved in §6).
- **New dependency**: `tesseract.js` (added to `package.json`), imported only via `await import('tesseract.js')` inside `KtpScanner.jsx` at the moment scanning starts — never a static top-level import, so it's excluded from the main bundle and only fetched when a user actually opens the scanner.

## 4. Data Flow

1. User taps "Scan KTP" (step 1) → `KtpScanner` modal opens, defaults to the **Kamera** tab.
2. **Kamera tab**: `getUserMedia({ video: { facingMode: 'environment' } })` → stream attached to a `<video>` element. A `requestAnimationFrame` loop draws the current video frame to an offscreen `<canvas>` and calls `analyzeFrameQuality` on its `ImageData`, throttled to roughly once per 300ms (not every frame) to avoid jank on low-end phones. Results render as small non-blocking badges ("Terlalu terang", "Buram", "Ada pantulan cahaya") near the live preview. The Jepret (capture) button is always enabled; pressing it takes the most recent analyzed canvas frame as the captured image and stops the camera stream.
3. **Upload File tab**: `<input type="file" accept="image/*">`. On file selection, the image is drawn once to the same offscreen canvas, `analyzeFrameQuality` runs once, and the same badges render next to a static preview thumbnail (advisory only, same as camera — user can proceed regardless).
4. Once an image exists (from either tab): show an OCR progress indicator, dynamically `import('tesseract.js')`, run `recognize()` on the captured/uploaded image, then call `extractNikAndNama(text)` on the result.
5. Review box appears: a 16-digit-max NIK text input and a Nama text input, both pre-filled with whatever was extracted (empty + a "gak kebaca otomatis, isi manual" hint if nothing matched). Both are freely editable.
6. "Terapkan ke Form" calls `onApply({ nik, nama })` with the (possibly edited) values and closes the modal. "Batal" (or the modal's close button) discards everything and closes without touching the form. Closing the modal always stops any active camera stream (cleanup on unmount).

## 5. Error Handling

- **Camera permission denied / no camera device**: catch the `getUserMedia` rejection, show an inline message, and switch the modal to the Upload File tab automatically (not a dead end).
- **`tesseract.js` fails to load or `recognize()` throws** (offline, CDN blocked, corrupt image): show a clear inline error in the modal ("OCR gagal, isi NIK/Nama manual") with a "Tutup" action — the wizard's normal manual NIK/Nama inputs remain fully usable either way, so this never blocks registration.
- **No 16-digit run found in OCR text**: NIK input starts empty, not a truncated/wrong guess.
- **Modal unmount while camera active**: `useEffect` cleanup calls `stream.getTracks().forEach(t => t.stop())` unconditionally, so leaving the modal (Kembali, browser back, closing) never leaves the camera light on.

## 6. Open Question Resolved: applying extracted values

`onApply({ nik, nama })` always **overwrites** `form.nik` and `form.nama` with whatever is in the review box at the moment "Terapkan ke Form" is pressed (the review box is pre-filled from OCR but the user may have already hand-edited it, or cleared a field they didn't want) — never a silent merge-only-if-empty, since the review step already is the point of confirmation.

## 7. Testing

- **`src/utils/__tests__/ktpScan.test.js`** (new):
  - `analyzeFrameQuality`: synthetic small pixel arrays — uniformly bright (`brightness: 'too-bright'`), uniformly dark (`'too-dark'`), mid-range flat (`brightness: 'ok'`), low-variance/flat texture (`blur: 'blurry'`), high-variance checkerboard-like pattern (`blur: 'ok'`), a small cluster of near-white pixels against a mid-tone background (`glare: 'glare'`), no such cluster (`glare: 'ok'`).
  - `extractNikAndNama`: clean OCR-like text with both fields present; text with NIK but no recognizable "Nama" line; text with neither; noisy/misspelled OCR output where "Nama" is still detectable; a decoy 15- or 17-digit number that must NOT match (only exactly 16 digits should).
- **No automated test for `KtpScanner.jsx` itself** (camera access, real `tesseract.js` OCR) — matches this codebase's existing convention of not testing `LocationPicker`/Leaflet's real map interactions. Manual test plan: open Scan KTP, grant/deny camera permission, test both tabs, verify badges change under different real lighting, verify OCR review box, verify Terapkan/Batal, verify camera light turns off on close.
