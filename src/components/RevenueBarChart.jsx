import React from 'react';
import { formatRupiahCompact } from '../utils/format';

const RevenueBarChart = ({ data }) => {
  const width = 300;
  const height = 100;
  const barGap = 8;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <svg viewBox={`0 0 ${width} ${height + 34}`} className="w-full" style={{ height: 'auto' }}>
      <title>Pendapatan kotor per bulan, 6 bulan terakhir</title>
      {data.map((item, idx) => {
        const barHeight = Math.max(Math.round((item.value / maxValue) * height), 2);
        const x = idx * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <g key={idx}>
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="9"
              fontWeight="700"
            >
              {formatRupiahCompact(item.value)}
            </text>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} fill="#2563eb" />
            <text
              x={x + barWidth / 2}
              y={height + 18}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="9"
              fontWeight="700"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default RevenueBarChart;
