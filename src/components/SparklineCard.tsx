import { useMemo } from 'react';
import { formatCurrency } from '../lib/format';

type Transaction = { id: number; amount: number; type: string; category: string; date: string; notes?: string | null };

export default function SparklineCard({
  transactions,
  label,
  type,
  colorClass,
}: {
  transactions: Transaction[];
  label: string;
  type: 'income' | 'expense';
  colorClass: string;
}) {
  const filtered = useMemo(
    () =>
      transactions
        .filter((t) => t.type === type)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14),
    [transactions, type]
  );

  const total = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);
  const values = filtered.map((t) => t.amount);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const width = 160;
  const height = 48;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * width : width / 2;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const gradientId = `spark-gradient-${type}`;
  const areaPoints = points.length > 0
    ? `0,${height} ${points.join(' ')} ${width},${height}`
    : '';

  const strokeColor = type === 'income' ? '#84CC16' : '#ef4444';
  const fillColor = type === 'income' ? '#b3ff4c40' : '#fee2e2';

  return (
    <div className={`glass-card p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{formatCurrency(total)}</div>
          <div className="mt-0.5 text-xs text-gray-400 font-medium">{filtered.length} transactions</div>
        </div>
        {values.length > 1 && (
          <svg width={width} height={height} className="flex-shrink-0 overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area fill */}
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />
            {/* Line */}
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* End dot */}
            {points.length > 0 && (
              <circle
                cx={parseFloat(points[points.length - 1].split(',')[0])}
                cy={parseFloat(points[points.length - 1].split(',')[1])}
                r="3"
                fill={strokeColor}
                className="animate-pulse"
              />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
