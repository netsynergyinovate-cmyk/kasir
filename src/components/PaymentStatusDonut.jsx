
const PaymentStatusDonut = ({ paidCount, unpaidCount }) => {
  const total = paidCount + unpaidCount;
  const size = 140;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const paidRatio = total > 0 ? paidCount / total : 0;
  const paidLength = circumference * paidRatio;
  const percentage = total > 0 ? Math.round(paidRatio * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <title>{`${paidCount} dari ${total} pelanggan aktif sudah bayar bulan ini`}</title>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f97316"
            strokeWidth={strokeWidth}
          />
          {paidCount > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#16a34a"
              strokeWidth={strokeWidth}
              strokeDasharray={`${paidLength} ${circumference - paidLength}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-black text-gray-900 leading-none">{percentage}%</p>
          <p className="text-[9px] font-bold text-gray-400 mt-1">{paidCount}/{total} Lunas</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-600 shrink-0"></span>
          <span className="text-xs font-bold text-gray-700">Sudah Bayar</span>
          <span className="text-xs font-black text-gray-900 ml-auto pl-4">{paidCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span>
          <span className="text-xs font-bold text-gray-700">Belum Bayar</span>
          <span className="text-xs font-black text-gray-900 ml-auto pl-4">{unpaidCount}</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusDonut;
