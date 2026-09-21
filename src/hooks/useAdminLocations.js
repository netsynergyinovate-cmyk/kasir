import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const POLL_MS = 20_000;

// Untuk superadmin: mengambil posisi terakhir semua admin dan memperbaruinya tiap 20 detik.
// Mengembalikan [{ id, name, lat, lng, updatedAt }].
export function useAdminLocations({ enabled }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const load = async () => {
      const [locationsRes, profilesRes] = await Promise.all([
        supabase.from('admin_locations').select('admin_id, lat, lng, updated_at'),
        supabase.from('admin_profiles').select('id, full_name'),
      ]);
      if (cancelled || locationsRes.error || !locationsRes.data) return;

      const names = {};
      (profilesRes.data || []).forEach((profile) => { names[profile.id] = profile.full_name; });

      setLocations(locationsRes.data.map((row) => ({
        id: row.admin_id,
        name: names[row.admin_id] || 'Admin',
        lat: row.lat,
        lng: row.lng,
        updatedAt: row.updated_at,
      })));
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return enabled ? locations : [];
}
