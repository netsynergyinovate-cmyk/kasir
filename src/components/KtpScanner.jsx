import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, X, Loader2, AlertTriangle, Check } from 'lucide-react';
import { analyzeFrameQuality, extractNikAndNama, findNikLineBbox } from '../utils/ktpScan';

const QUALITY_CHECK_INTERVAL_MS = 300;
const SCAN_CANVAS_WIDTH = 320; // downscale buat loop cek kualitas real-time biar cepat/murah per-frame
const CAPTURE_MAX_WIDTH = 1280; // resolusi gambar hasil jepret/upload yang sebenarnya dipakai buat OCR
// tesseract.js ngunduh model bahasa (~10-15MB) dari CDN pas pertama dipakai — kalau internet lambat/
// diblokir, tanpa batas waktu ini bakal kelihatan "macet" selamanya tanpa pesan apa pun.
const OCR_TIMEOUT_MS = 45000;

const OCR_STATUS_LABELS = {
  'loading tesseract core': 'Menyiapkan OCR...',
  'initializing tesseract': 'Menyiapkan OCR...',
  'loading language traineddata': 'Mengunduh model bahasa...',
  'initializing api': 'Menyiapkan OCR...',
  'recognizing text': 'Membaca teks KTP...',
};

// Tahapan besar proses scan, ditandai LANGSUNG dari kode kita sendiri (bukan cuma nunggu callback
// logger dari tesseract.js) — jadi tetap kelihatan bergerak walau logger internalnya gak pernah
// ngirim update (kayak yang kejadian pas macet), dan user bisa lihat persis nyangkutnya di tahap mana.
const OCR_STEPS = [
  { key: 'loading-module', label: 'Memuat modul OCR' },
  { key: 'starting-worker', label: 'Menyiapkan mesin OCR & model bahasa' },
  { key: 'recognizing', label: 'Membaca teks dari KTP' },
  { key: 'refining-nik', label: 'Membaca ulang NIK secara khusus' },
];

// NIK e-KTP dicetak pakai font OCR-A Extended (didesain khusus buat mesin baca, tapi BEDA bentuk dari
// font biasa) — model Tesseract umum sering ketuker huruf/angka di situ (1 dibaca L, 4 dibaca %, dst),
// walau baris lain (Nama dst, font Arial biasa) kebaca lancar. Kalau pass pertama gagal dapat NIK 16
// digit, baris paling padat angka di-crop pakai `rectangle` bawaan Tesseract lalu dibaca ULANG dengan
// tessedit_char_whitelist dikunci ke digit doang — menghilangkan kemungkinan ketuker huruf sama sekali.
const NIK_CROP_PADDING_RATIO = 0.4; // baris NIK biasanya pendek & tebal; kasih margin lumayan biar gak kepotong

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
  const [ocrProgress, setOcrProgress] = useState(null); // { label, percent } | null
  const [ocrStep, setOcrStep] = useState(null); // salah satu key di OCR_STEPS | null
  const [reviewNik, setReviewNik] = useState('');
  const [reviewNama, setReviewNama] = useState('');
  const [uploadError, setUploadError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    // React StrictMode (dev) sengaja jalanin efek 2x pas mount (setup->cleanup->setup) buat nangkep
    // bug kayak ini — setup WAJIB nyetel balik ke true, bukan cuma andelin nilai awal useRef(true),
    // soalnya cleanup dari invoke pertama bakal nyetel false duluan sebelum invoke kedua ini jalan.
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    const qualityScale = SCAN_CANVAS_WIDTH / video.videoWidth;
    canvas.width = SCAN_CANVAS_WIDTH;
    canvas.height = Math.round(video.videoHeight * qualityScale);
    const qctx = canvas.getContext('2d');
    qctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const qualityImageData = qctx.getImageData(0, 0, canvas.width, canvas.height);
    setQualityWarnings(warningsFromQuality(analyzeFrameQuality(qualityImageData)));

    const captureScale = Math.min(CAPTURE_MAX_WIDTH / video.videoWidth, 1);
    canvas.width = Math.round(video.videoWidth * captureScale);
    canvas.height = Math.round(video.videoHeight * captureScale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));

    stopCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onerror = () => setUploadError('Gagal membaca file. Coba file lain.');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setUploadError('File bukan gambar yang valid atau rusak. Coba file lain.');
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas || !img.width || !img.height) {
          setUploadError('Gambar tidak valid. Coba file lain.');
          return;
        }
        try {
          const qualityScale = SCAN_CANVAS_WIDTH / img.width;
          canvas.width = SCAN_CANVAS_WIDTH;
          canvas.height = Math.round(img.height * qualityScale);
          const qctx = canvas.getContext('2d');
          qctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const qualityImageData = qctx.getImageData(0, 0, canvas.width, canvas.height);
          setQualityWarnings(warningsFromQuality(analyzeFrameQuality(qualityImageData)));

          const captureScale = Math.min(CAPTURE_MAX_WIDTH / img.width, 1);
          canvas.width = Math.round(img.width * captureScale);
          canvas.height = Math.round(img.height * captureScale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
        } catch (err) {
          setUploadError(`Gagal memproses gambar (${err.message}). Coba file lain.`);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const runOcr = useCallback(async (imageDataUrl) => {
    setOcrStatus('running');
    setOcrError(null);
    setOcrProgress(null);
    setOcrStep('loading-module');
    let worker = null;
    try {
      const Tesseract = await import('tesseract.js');
      if (!mountedRef.current) return;
      setOcrStep('starting-worker');
      const pipeline = (async () => {
        // Worker/model bahasa dijadikan lokal (public/tesseract/) — bukan default CDN jsdelivr.
        // 'ind+eng': KTP isinya teks Indonesia (Nama, alamat, status, dll) — model gabungan lebih
        // akurat daripada 'eng' doang, sambil tetap kuat baca angka NIK & tanggal format Latin.
        worker = await Tesseract.createWorker('ind+eng', 1, {
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract/tesseract-core-lstm.wasm.js',
          langPath: '/tesseract',
          logger: (m) => {
            if (!mountedRef.current) return;
            if (m.status === 'recognizing text') setOcrStep((s) => (s === 'refining-nik' ? s : 'recognizing'));
            if (typeof m.progress === 'number') {
              setOcrProgress({ label: OCR_STATUS_LABELS[m.status] || 'Memproses...', percent: Math.round(m.progress * 100) });
            }
          },
        });
        // { blocks: true } dibutuhkan biar hasilnya bawa bbox per baris (dipakai buat crop NIK di
        // bawah) — tesseract.js defaultnya cuma balikin teks polos.
        const { data } = await worker.recognize(imageDataUrl, {}, { blocks: true });
        console.log('[KtpScanner] Teks hasil OCR (pass 1):', data.text);
        const { nik: nikFromText, nama } = extractNikAndNama(data.text);
        let nik = nikFromText;

        if (!nik) {
          const bbox = findNikLineBbox(data.blocks);
          if (bbox) {
            setOcrStep('refining-nik');
            const width = bbox.x1 - bbox.x0;
            const height = bbox.y1 - bbox.y0;
            const padX = width * NIK_CROP_PADDING_RATIO;
            const padY = height * NIK_CROP_PADDING_RATIO;
            await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
            const { data: nikData } = await worker.recognize(imageDataUrl, {
              rectangle: {
                left: Math.max(0, Math.round(bbox.x0 - padX)),
                top: Math.max(0, Math.round(bbox.y0 - padY)),
                width: Math.round(width + padX * 2),
                height: Math.round(height + padY * 2),
              },
            });
            console.log('[KtpScanner] Hasil OCR ulang khusus NIK (pass 2, digit-only):', JSON.stringify(nikData.text));
            const digitsOnly = nikData.text.replace(/[^0-9]/g, '');
            if (digitsOnly.length === 16) nik = digitsOnly;
          }
        }

        return { nik, nama };
      })();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Waktu OCR habis — kemungkinan koneksi internet lambat/terblokir saat mengunduh model bahasa. Coba lagi di jaringan yang lebih baik, atau isi manual.')), OCR_TIMEOUT_MS);
      });
      const { nik, nama } = await Promise.race([pipeline, timeoutPromise]);
      if (!mountedRef.current) return;
      setReviewNik(nik || '');
      setReviewNama(nama || '');
      setOcrStatus('done');
    } catch (err) {
      console.error('[KtpScanner] OCR gagal:', err);
      if (!mountedRef.current) return;
      setOcrError(`OCR gagal jalan (${err.message}). Isi NIK/Nama manual di form.`);
      setOcrStatus('error');
    } finally {
      if (worker) worker.terminate().catch(() => {});
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
    setOcrProgress(null);
    setOcrStep(null);
    setReviewNik('');
    setReviewNama('');
    setQualityWarnings([]);
    setUploadError(null);
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
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                    <div
                      className="relative w-full border-2 border-dashed border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                      style={{ aspectRatio: '85.6 / 53.98', maxHeight: '100%' }}
                    >
                      {/* Perkiraan posisi baris NIK & Nama di layout e-KTP standar, buat bantu user pas-in kartu.
                          Style inline (bukan kelas arbitrary Tailwind) supaya persentasenya dijamin kepakai. */}
                      <div
                        className="absolute border border-yellow-300/90 rounded-sm flex items-center px-1"
                        style={{ left: '3%', top: '17%', width: '58%', height: '9%' }}
                      >
                        <span className="text-yellow-200 text-[8px] font-bold drop-shadow">NIK</span>
                      </div>
                      <div
                        className="absolute border border-sky-300/90 rounded-sm flex items-center px-1"
                        style={{ left: '3%', top: '29%', width: '58%', height: '7%' }}
                      >
                        <span className="text-sky-200 text-[8px] font-bold drop-shadow">Nama</span>
                      </div>
                    </div>
                  </div>
                  <p className="absolute bottom-2 left-0 right-0 text-center text-white text-[11px] font-bold drop-shadow pointer-events-none">
                    Posisikan KTP di dalam kotak — sejajarkan baris NIK &amp; Nama dengan kotak kuning/biru
                  </p>
                </div>
                {qualityWarnings.length > 0 && warningList}
                <button type="button" onClick={handleCapture} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Camera size={18} /> Ambil Gambar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 cursor-pointer active:scale-95 transition-all">
                  <Upload size={16} />
                  Pilih Foto KTP
                  <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                </label>
                {uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}
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
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                {OCR_STEPS.map((step, i) => {
                  const currentIndex = OCR_STEPS.findIndex((s) => s.key === ocrStep);
                  const isDone = currentIndex > i;
                  const isCurrent = currentIndex === i;
                  return (
                    <p
                      key={step.key}
                      className={`text-xs font-bold flex items-center gap-2 ${
                        isCurrent ? 'text-gray-800' : isDone ? 'text-emerald-600' : 'text-gray-300'
                      }`}
                    >
                      {isDone ? (
                        <Check size={14} className="shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 size={14} className="animate-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0 inline-block" />
                      )}
                      {step.label}
                      {isCurrent && ocrProgress && ` — ${ocrProgress.percent}%`}
                    </p>
                  );
                })}
              </div>
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
