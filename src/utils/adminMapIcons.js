import L from 'leaflet';

export const MAP_ICON_TYPES = [
  {
    id: 'motor',
    label: 'Sepeda Motor',
    iconText: '🏍️',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-3 6h6l2-3h2.5"/><path d="M9 12l2 5.5"/></svg>`
  },
  {
    id: 'mobil',
    label: 'Mobil Operasional',
    iconText: '🚗',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.8 2 12.4V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`
  },
  {
    id: 'technician',
    label: 'Teknisi Jaringan',
    iconText: '⚡',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
  },
  {
    id: 'person',
    label: 'Petugas Lapangan',
    iconText: '🚶',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg>`
  },
  {
    id: 'admin',
    label: 'Admin Kasir',
    iconText: '🛡️',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg>`
  },
  {
    id: 'crown',
    label: 'Super Admin',
    iconText: '👑',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`
  },
  {
    id: 'beacon',
    label: 'Radar Lapangan',
    iconText: '🎯',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`
  },
];

export const MAP_ICON_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Orange', value: '#ea580c' },
];

export function getDeterministicColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MAP_ICON_COLORS.length;
  return MAP_ICON_COLORS[index].value;
}

export function getInitials(name = '') {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Render Leaflet divIcon untuk Admin/Petugas di peta agar:
 * 1. Tidak sama dengan pin teardrop pelanggan
 * 2. Tidak sama antar masing-masing admin (setiap admin punya icon, warna, inisial & label nama sendiri)
 * 3. Mendukung kustomisasi penuh per-admin
 */
export function createAdminMapIcon(person = {}, isSelf = false, isStale = false) {
  const mapIconConfig = person.mapIcon || person.map_icon || {};
  const iconTypeId = mapIconConfig.type || (person.role === 'superadmin' ? 'crown' : 'motor');
  const matchedType = MAP_ICON_TYPES.find((t) => t.id === iconTypeId) || MAP_ICON_TYPES[0];

  const adminName = person.name || person.title?.split('·')[0]?.trim() || (isSelf ? 'Saya' : 'Admin');
  const color = isStale 
    ? '#6b7280' 
    : (mapIconConfig.color || getDeterministicColor(person.id || adminName));
  const initials = mapIconConfig.label || getInitials(adminName);

  const isSuper = person.role === 'superadmin';
  const pulseColor = isSelf ? '#2563eb' : color;

  const html = `
    <div class="admin-field-marker" style="position:relative;width:40px;height:48px;display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.35));transition:transform 0.15s ease;">
      ${(isSelf || !isStale) ? `
        <div style="position:absolute;top:3px;left:3px;width:34px;height:34px;border-radius:9999px;background:${pulseColor};opacity:0.3;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      ` : ''}
      
      <!-- Lingkaran Marker Utama -->
      <div style="position:relative;width:36px;height:36px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.25);z-index:2;">
        ${matchedType.svg}
        
        <!-- Badge Inisial / Crown di Pojok -->
        <div style="position:absolute;top:-4px;right:-4px;background:#ffffff;color:${color};font-size:9px;font-weight:900;font-family:system-ui,sans-serif;padding:1px 3.5px;border-radius:9999px;border:1.5px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,0.2);line-height:1;">
          ${isSuper ? '👑' : initials}
        </div>
      </div>
      
      <!-- Panah Penunjuk Bawah (Pointer Segitiga) -->
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color};margin-top:-1.5px;z-index:1;"></div>

      <!-- Label Nama Admin di Bawah Marker -->
      <div style="position:absolute;top:42px;background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);color:#ffffff;font-size:9px;font-weight:800;font-family:system-ui,sans-serif;padding:1.5px 6px;border-radius:6px;white-space:nowrap;pointer-events:none;border:1px solid rgba(255,255,255,0.2);box-shadow:0 2px 4px rgba(0,0,0,0.25);">
        ${isSelf ? '📍 Posisi Anda' : adminName}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-admin-marker',
    html,
    iconSize: [40, 48],
    iconAnchor: [20, 40],
    tooltipAnchor: [0, -38],
  });
}
