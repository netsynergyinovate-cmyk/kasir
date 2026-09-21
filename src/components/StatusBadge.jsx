import { TONE_BADGE_CLASSES } from '../utils/visits';

// Lencana status kunjungan pelanggan (label berasal dari customerVisitStatus).
const StatusBadge = ({ status }) => (
  <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${TONE_BADGE_CLASSES[status.tone]}`}>
    {status.label}
  </span>
);

export default StatusBadge;
