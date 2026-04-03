import { useState, useMemo } from 'react';
import { formatCurrency } from '../lib/format';

type TrendItem = { period: string; type: string; total: number };

export default function BarChart({ data }: { data: TrendItem[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Group by period, get income & expense for each month
  const grouped = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const d of data) {
      const existing = map.get(d.period) || { income: 0, expense: 0 };
      if (d.type === 'income') existing.income += d.total;
      else existing.expense += d.total;
      map.set(d.period, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([period, vals]) => ({ period, ...vals }));
  }, [data]);

  if (!grouped || grouped.length === 0) {
    return <div className="text-sm text-gray-500 font-medium">No trend data to display.</div>;
  }

  const maxVal = Math.max(...grouped.flatMap((g) => [g.income, g.expense]), 1);
  const chartHeight = 180;
  const barWidth = 18;
  const gap = 8;
  const groupWidth = barWidth * 2 + gap;
  const padding = { left: 50, right: 20, top: 20, bottom: 40 };
  const chartWidth = grouped.length * (groupWidth + 24) + padding.left + padding.right;

  // Y-axis grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  function formatShort(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n}`;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${Math.max(chartWidth, 400)} ${chartHeight + padding.top + padding.bottom}`} className="min-w-[300px]">
        {/* Grid lines */}
        {gridLines.map((pct, i) => {
          const y = padding.top + chartHeight - pct * chartHeight;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#a1a1aa" fontSize={10} fontFamily="monospace" fontWeight="500">
                {formatShort(pct * maxVal)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {grouped.map((g, i) => {
          const x = padding.left + i * (groupWidth + 24);
          const incomeH = (g.income / maxVal) * chartHeight;
          const expenseH = (g.expense / maxVal) * chartHeight;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={g.period}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Hover background */}
              {isHovered && (
                <rect
                  x={x - 8}
                  y={padding.top}
                  width={groupWidth + 16}
                  height={chartHeight + 28}
                  rx={8}
                  fill="rgba(0,0,0,0.03)"
                />
              )}

              {/* Income bar */}
              <rect
                x={x}
                y={padding.top + chartHeight - incomeH}
                width={barWidth}
                height={incomeH}
                rx={4}
                fill={isHovered ? '#84CC16' : '#84CC1680'}
                className="transition-all duration-300"
              />

              {/* Expense bar */}
              <rect
                x={x + barWidth + gap}
                y={padding.top + chartHeight - expenseH}
                width={barWidth}
                height={expenseH}
                rx={4}
                fill={isHovered ? '#ef4444' : '#ef444480'}
                className="transition-all duration-300"
              />

              {/* Period label */}
              <text
                x={x + groupWidth / 2}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                fill={isHovered ? '#1a1a1a' : '#a1a1aa'}
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
                className="transition-all duration-200"
              >
                {g.period.slice(5)}
              </text>

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x - 10}
                    y={padding.top - 2}
                    width={groupWidth + 30}
                    height={38}
                    rx={6}
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.08)"
                  />
                  <text x={x + groupWidth / 2} y={padding.top + 12} textAnchor="middle" fill="#166534" fontSize={10} fontWeight="bold">
                    ↑ {formatShort(g.income)}
                  </text>
                  <text x={x + groupWidth / 2} y={padding.top + 26} textAnchor="middle" fill="#991b1b" fontSize={10} fontWeight="bold">
                    ↓ {formatShort(g.expense)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs font-medium">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#84cc16]" />
          <span className="text-gray-600">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-gray-600">Expense</span>
        </div>
      </div>
    </div>
  );
}
