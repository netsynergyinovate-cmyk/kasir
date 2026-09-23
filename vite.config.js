import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import localApi from './vite-plugin-local-api.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localApi(),
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
})
