// Saklar on/off yang dipakai di halaman Settings (E-Billing, Runsnet), satu gaya untuk semuanya.
const COLORS = { blue: 'peer-checked:bg-blue-600', amber: 'peer-checked:bg-amber-500' };

const ToggleSwitch = ({ checked, onChange, disabled = false, color = 'blue', label }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="sr-only peer"
    />
    <div className={`w-11 h-6 bg-gray-200 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300 rounded-full peer peer-disabled:opacity-50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${COLORS[color]}`}></div>
  </label>
);

export default ToggleSwitch;
