const BADGE_CLASSES = {
  sudah_bayar: 'bg-emerald-100 text-emerald-700',
  menunggu: 'bg-amber-100 text-amber-700',
  perlu_didatangi: 'bg-red-100 text-red-700',
  belum_dikunjungi: 'bg-red-100 text-red-700',
};

// Lencana status kunjungan pelanggan (label berasal dari customerVisitStatus).
const StatusBadge = ({ status }) => (
  <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${BADGE_CLASSES[status.key]}`}>
    {status.label}
  </span>
);

export default StatusBadge;
