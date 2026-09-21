// Logo untuk struk thermal: hitam-putih murni (tanpa abu-abu), supaya yang tampil di pratinjau sama
// dengan yang tercetak di printer 58mm. Piksel transparan dianggap putih.
export const LOGO_WIDTH = 160; // kelipatan 8, lebar bitmap ESC/POS untuk kertas 58mm
export const LOGO_MAX_HEIGHT = 96;

// Mengubah piksel RGBA (in-place) jadi hitam/putih: gelap = hitam, terang/transparan = putih.
export function thresholdToBlackWhite(pixels, threshold = 140) {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    const luminance = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) * alpha + 255 * (1 - alpha);
    const value = luminance < threshold ? 0 : 255;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  return pixels;
}

// Memuat logo dari URL/data URL dan mengembalikan data URL PNG hitam-putih selebar LOGO_WIDTH
// (logo digambar di tengah, skala menjaga rasio). Mengembalikan null kalau gagal dimuat.
export function loadReceiptLogo(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(LOGO_WIDTH / img.width, LOGO_MAX_HEIGHT / img.height);
        const drawWidth = Math.max(1, Math.round(img.width * scale));
        const drawHeight = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = LOGO_WIDTH;
        canvas.height = drawHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, Math.floor((LOGO_WIDTH - drawWidth) / 2), 0, drawWidth, drawHeight);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        thresholdToBlackWhite(data.data);
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
