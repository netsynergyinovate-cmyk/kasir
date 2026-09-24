import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const POLL_MS = 15_000;

// Untuk superadmin: posisi terakhir semua admin, diperbarui langsung saat ada perubahan lewat Supabase
// Realtime, dengan polling 15 detik sebagai cadangan (mis. bila Realtime belum diaktifkan di database).
// Mengembalikan [{ id, name, lat, lng, accuracy, updatedAt }].
export function useAdminLocations({ enabled }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const load = async () => {
      const [locationsRes, profilesRes] = await Promise.all([
        supabase.from('admin_locations').select('admin_id, lat, lng, accuracy, updated_at'),
        supabase.from('admin_profiles').select('id, full_name, role, allowed_paths'),
      ]);
      if (cancelled || locationsRes.error || !locationsRes.data) return;

      const profilesMap = {};
      (profilesRes.data || []).forEach((profile) => {
        profilesMap[profile.id] = {
          name: profile.full_name,
          role: profile.role,
          mapIcon: profile.allowed_paths?.map_icon || null,
        };
      });

      setLocations(locationsRes.data.map((row) => ({
        id: row.admin_id,
        name: profilesMap[row.admin_id]?.name || 'Admin',
        role: profilesMap[row.admin_id]?.role || 'admin',
        mapIcon: profilesMap[row.admin_id]?.mapIcon || null,
        lat: row.lat,
        lng: row.lng,
        accuracy: row.accuracy,
        updatedAt: row.updated_at,
      })));
    };

    load();
    const timer = setInterval(load, POLL_MS);
    const channel = supabase
      .channel('admin-locations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_locations' }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return enabled ? locations : [];
}
