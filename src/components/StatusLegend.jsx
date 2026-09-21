import { TONE_COLORS } from '../utils/visits';

const ITEMS = [
  ['red', 'Belum dikunjungi'],
  ['yellow', 'Tidak ada di rumah'],
  ['blue', 'Uang belum ada'],
  ['green', 'Sudah terbayarkan'],
];

// Keterangan warna penanda peta dan lencana status kunjungan.
const StatusLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-gray-500 px-1">
    {ITEMS.map(([tone, label]) => (
      <span key={tone} className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONE_COLORS[tone] }} /> {label}
      </span>
    ))}
  </div>
);

export default StatusLegend;
