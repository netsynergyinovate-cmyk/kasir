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

// Label baris — dipakai buat cari baris "NIK ..." / "Nama ..." begitu regex utuh di atas gagal (OCR
// sering nyelipin spasi/noise di tengah nomor). Longgar (case-insensitive) karena OCR gratisan sering
// salah kapitalisasi.
const NIK_LABEL_REGEX = /nik\s*[:-]?\s*(.*)/i;
const NAMA_LABEL_REGEX = /nama\s*[:-]?\s*(.*)/i;

function findLabeledLine(lines, labelRegex) {
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(labelRegex);
    if (match) {
      const sameLine = match[1].trim();
      return sameLine || (lines[i + 1] ? lines[i + 1].trim() : '');
    }
  }
  return null;
}

// Nebak NIK & Nama dari teks mentah hasil OCR satu foto KTP. TIDAK dijamin selalu benar — caller
// WAJIB nampilin hasil ini sebagai draft yang bisa diedit, bukan langsung dipakai.
export function extractNikAndNama(ocrText) {
  const text = String(ocrText || '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // NIK: coba dulu 16 digit terisolasi di mana pun di teks (andal kalau OCR-nya bersih). Kalau gagal
  // — biasanya karena OCR nyelipin spasi di tengah nomor ("3174 0961 1290 0001") yang mecah deretan
  // digitnya — cari baris berlabel "NIK", buang semua karakter selain angka di sisa baris itu; kalau
  // hasilnya persis 16 digit, cukup yakin itu NIK aslinya (baris itu emang khusus buat NIK di KTP).
  const directNikMatch = text.match(NIK_REGEX);
  let nik = directNikMatch ? directNikMatch[1] : null;
  if (!nik) {
    const nikLine = findLabeledLine(lines, NIK_LABEL_REGEX);
    if (nikLine) {
      const digitsOnly = nikLine.replace(/[^0-9]/g, '');
      if (digitsOnly.length === 16) nik = digitsOnly;
    }
  }

  const nama = findLabeledLine(lines, NAMA_LABEL_REGEX) || null;

  return { nik, nama };
}

// Minimal jumlah digit di satu baris biar dianggap kandidat baris NIK — cukup tinggi buat gak
// kepancing baris tanggal lahir/RT-RW (yang paling banyak ~8 digit), tapi cukup rendah buat tetep
// nangkep NIK yang beberapa karakternya kebaca salah jadi huruf (NIK asli 16 digit, jarang keliru
// lebih dari 3-4 karakter dalam satu baris).
const NIK_LINE_MIN_DIGITS = 10;

// Cari baris paling padat angka dari hasil OCR pass pertama (data.blocks Tesseract, sudah termasuk
// bbox per baris) — dipakai buat OCR ulang KHUSUS baris itu dengan whitelist digit-only, karena NIK
// di e-KTP pakai font OCR-A yang model Tesseract umum sering ketuker sama huruf. Gak gantung ke teks
// label "NIK" kebaca bener atau nggak (kadang itu sendiri kebaca "NE" dll) — cuma liat baris mana yang
// paling banyak angkanya, dan NIK adalah satu-satunya baris di KTP yang isinya angka semua.
export function findNikLineBbox(blocks) {
  const lines = (blocks || []).flatMap((b) => (b.paragraphs || []).flatMap((p) => p.lines || []));
  let best = null;
  let bestDigitCount = 0;
  for (const line of lines) {
    const digitCount = (line.text.match(/\d/g) || []).length;
    if (digitCount >= NIK_LINE_MIN_DIGITS && digitCount > bestDigitCount) {
      bestDigitCount = digitCount;
      best = line;
    }
  }
  return best ? best.bbox : null;
}
