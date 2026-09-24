import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import localApi from './vite-plugin-local-api.js'

// onnxruntime-web (dipakai PaddleOCR) me-load worker-nya (ort-wasm-simd-threaded.jsep.mjs) lewat
// import() dinamis saat runtime. Vite dev server menolak itu untuk file di public/ ("should not be
// imported from source code, only referenced via HTML tags") — 500 khusus, bukan 404. Restriksi ini
// cuma berlaku di dev server; saat `npm run build` public/ dicopy mentah tanpa lewat middleware ini,
// jadi harusnya tetap jalan normal di production. Plugin ini serve file .mjs itu mentah, memotong jalur
// sebelum middleware transform Vite sempat menolaknya — sama pola dengan vite-plugin-local-api.js.
function rawServeOnnxWasmModules() {
  return {
    name: 'raw-serve-onnx-wasm-modules',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/paddle-ocr/ort/') || !req.url.split('?')[0].endsWith('.mjs')) return next();
        const file = path.join(server.config.root, 'public', decodeURIComponent(req.url.split('?')[0]));
        if (!fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'text/javascript');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localApi(),
    rawServeOnnxWasmModules(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'hero.png'],
      workbox: {
        // Model/WASM OCR (Tesseract + PaddleOCR) diambil ON-DEMAND cuma pas fitur Scan KTP dipakai —
        // gak perlu (dan gede banget, bikin build PWA gagal karena ngelewatin limit 2MB default) buat
        // di-precache buat semua orang pas app pertama dibuka. Pattern *.wasm ikut nyapu file WASM yang
        // ke-bundle otomatis sama onnxruntime-web ke dist/assets/ (bukan cuma yang di public/ kita).
        globIgnores: ['**/tesseract/**', '**/paddle-ocr/**', '**/*.wasm', '**/*.ort'],
      },
      manifest: {
        name: 'KAsir ISP Billing',
        short_name: 'KAsir',
        description: 'Aplikasi Kasir Penagihan ISP RT RW Net',
        theme_color: '#2563eb',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'hero.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'hero.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'hero.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    allowedHosts: true,
  },
})
