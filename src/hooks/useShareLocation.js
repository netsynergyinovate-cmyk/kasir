import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { shouldUploadLocation } from '../utils/location';
import { distanceMeters } from '../utils/geo';

const ROUTE_ORIGIN_MOVE_METERS = 150;
const HEARTBEAT_MS = 60_000;

// Membagikan posisi admin ke superadmin selama aplikasi terbuka, dan menyediakan posisi itu untuk
// rute jalan (titik awal). Hanya jalan di browser: bila layar dikunci / aplikasi ditutup, pembaruan berhenti.
//
// status: 'off' | 'unsupported' | 'waiting' | 'active' | 'denied' | 'unavailable'
// position: posisi terbaru; routeOrigin: posisi yang hanya diperbarui saat bergeser > 150 m supaya
// jalur jalan tidak dihitung ulang terus-menerus.
export function useShareLocation({ enabled, userId }) {
  const [state, setState] = useState({ status: 'waiting', position: null, routeOrigin: null });
  const lastUploadRef = useRef(null);
  const latestRef = useRef(null);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const active = Boolean(enabled && userId && supported);

  useEffect(() => {
    if (!active) return undefined;

    const upload = (position) => {
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
    };

    const watchId = navigator.geolocation.watchPosition(
      (result) => {
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
      },
      (error) => {
        setState((previous) => ({ ...previous, status: error.code === 1 ? 'denied' : 'unavailable' }));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );

    // Saat admin diam, watchPosition jarang memicu callback; kirim ulang posisi terakhir agar tetap "aktif".
    const heartbeat = setInterval(() => {
      if (latestRef.current) upload(latestRef.current);
    }, HEARTBEAT_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
    };
  }, [active, userId]);

  let status = state.status;
  if (!enabled) status = 'off';
  else if (!supported) status = 'unsupported';

  return { status, position: active ? state.position : null, routeOrigin: active ? state.routeOrigin : null };
}
