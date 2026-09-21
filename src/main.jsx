import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { UPDATE_READY_EVENT, setApplyUpdate } from './utils/appUpdate'

// Service Worker PWA. Versi baru TIDAK memuat ulang halaman sendiri (bisa menghapus struk yang belum disimpan);
// sebagai gantinya muncul banner "Versi baru tersedia" dan kasir menekan Perbarui saat siap. Pembaruan dicek
// tiap menit dan setiap aplikasi kembali dibuka, supaya perangkat tidak tertinggal di versi lama.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event(UPDATE_READY_EVENT))
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    setInterval(check, 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})
setApplyUpdate(() => updateSW(true))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
