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
