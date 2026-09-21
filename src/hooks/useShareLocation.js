import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { shouldUploadLocation } from '../utils/location';
import { distanceMeters } from '../utils/geo';

const ROUTE_ORIGIN_MOVE_METERS = 150;
const HEARTBEAT_MS = 30_000;
// maximumAge 0: selalu minta posisi baru dari GPS, jangan pakai hasil lama dari cache browser.
const GEO_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };

// Membagikan posisi admin ke superadmin selama aplikasi terbuka, dan menyediakan posisi itu untuk
// rute jalan (titik awal). Hanya jalan di browser: bila layar dikunci / aplikasi ditutup, pembaruan berhenti.
//
// status: 'off' | 'unsupported' | 'insecure' | 'waiting' | 'active' | 'denied' | 'unavailable'
// position: { lat, lng, accuracy } terbaru; routeOrigin: posisi yang hanya diperbarui saat bergeser > 150 m
// supaya jalur jalan tidak dihitung ulang terus-menerus.
// retry(): dipanggil dari ketukan tombol; memicu dialog izin lokasi (beberapa browser hanya menampilkannya
// setelah interaksi pengguna) dan memulai ulang pemantauan.
export function useShareLocation({ enabled, userId }) {
  const [state, setState] = useState({ status: 'waiting', position: null, routeOrigin: null });
  const [attempt, setAttempt] = useState(0);
  const lastUploadRef = useRef(null);
  const latestRef = useRef(null);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const secure = typeof window === 'undefined' || window.isSecureContext !== false;
  const active = Boolean(enabled && userId && supported && secure);

  const upload = useCallback((position) => {
    lastUploadRef.current = { ...position, at: Date.now() };
    supabase
      .from('admin_locations')
      .upsert({
        admin_id: userId,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'admin_id' })
      .then(({ error }) => {
        if (error) console.warn('Gagal mengirim posisi admin:', error.message);
      });
  }, [userId]);

  const handleSuccess = useCallback((result) => {
    const position = { lat: result.coords.latitude, lng: result.coords.longitude, accuracy: result.coords.accuracy };
    latestRef.current = position;

    setState((previous) => ({
      status: 'active',
      position,
      routeOrigin: !previous.routeOrigin || distanceMeters(previous.routeOrigin, position) > ROUTE_ORIGIN_MOVE_METERS
        ? position
        : previous.routeOrigin,
    }));

    if (shouldUploadLocation(lastUploadRef.current, position, Date.now())) upload(position);
  }, [upload]);

  const handleError = useCallback((error) => {
    setState((previous) => ({ ...previous, status: error.code === 1 ? 'denied' : 'unavailable' }));
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, GEO_OPTIONS);

    // Saat admin diam, watchPosition jarang memicu callback; kirim ulang posisi terakhir agar tetap "aktif".
    const heartbeat = setInterval(() => {
      if (latestRef.current) upload(latestRef.current);
    }, HEARTBEAT_MS);

    // Kembali ke aplikasi setelah layar dikunci/pindah tab: minta posisi segar segera.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, GEO_OPTIONS);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, attempt, handleSuccess, handleError, upload]);

  const retry = useCallback(() => {
    if (!active) return;
    // Dipanggil langsung di dalam handler klik supaya browser mau menampilkan dialog izin.
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, GEO_OPTIONS);
    setState((previous) => ({ ...previous, status: previous.position ? previous.status : 'waiting' }));
    setAttempt((count) => count + 1);
  }, [active, handleSuccess, handleError]);

  let status = state.status;
  if (!enabled) status = 'off';
  else if (!supported) status = 'unsupported';
  else if (!secure) status = 'insecure';

  return { status, position: active ? state.position : null, routeOrigin: active ? state.routeOrigin : null, retry };
}
