import { useState, useMemo } from 'react';
import { formatCurrency } from '../lib/format';

type Slice = { category: string; total: number; type: string };

const COLORS = [
  '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa',
  '#fb923c', '#2dd4bf', '#e879f9', '#38bdf8', '#f87171',
];

export default function DonutChart({ data, size = 220 }: { data: Slice[]; size?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data]);

  const slices = useMemo(() => {
    let cumulative = 0;
    return data.map((d, i) => {
      const pct = d.total / total;
      const start = cumulative;
      cumulative += pct;
      return { ...d, pct, start, end: cumulative, color: COLORS[i % COLORS.length] };
    });
  }, [data, total]);

  if (!data || data.length === 0) {
    return <div className="text-sm text-gray-500 font-medium">No category data to display.</div>;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const strokeWidth = size * 0.15;
  const circumference = 2 * Math.PI * radius;

  function polarToCartesian(centerX: number, centerY: number, r: number, angle: number) {
    return {
      x: centerX + r * Math.cos(angle - Math.PI / 2),
      y: centerY + r * Math.sin(angle - Math.PI / 2),
    };
  }

  function arcPath(startAngle: number, endAngle: number) {
    const s = polarToCartesian(cx, cy, radius, startAngle);
    const e = polarToCartesian(cx, cy, radius, endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-6">
      {/* SVG Donut */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={strokeWidth} />
          {/* Slices */}
          {slices.map((sl, i) => {
            const startAngle = sl.start * 2 * Math.PI;
            const endAngle = sl.end * 2 * Math.PI;
            const gap = 0.02;
            const adjustedStart = startAngle + gap;
            const adjustedEnd = endAngle - gap;
            if (adjustedEnd <= adjustedStart) return null;
            return (
              <path
                key={i}
                d={arcPath(adjustedStart, adjustedEnd)}
                fill="none"
                stroke={sl.color}
                strokeWidth={hovered === i ? strokeWidth + 6 : strokeWidth}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                style={{
                  opacity: hovered !== null && hovered !== i ? 0.35 : 1,
                  filter: hovered === i ? `drop-shadow(0 0 8px ${sl.color}80)` : 'none',
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hovered !== null ? (
            <>
              <div className="text-xs text-gray-500 font-bold uppercase">{slices[hovered].category}</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(slices[hovered].total)}</div>
              <div className="text-xs text-gray-500 font-medium">{(slices[hovered].pct * 100).toFixed(1)}%</div>
            </>
          ) : (
            <>
              <div className="text-xs text-gray-500 font-bold uppercase">Total</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(total)}</div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs w-full">
        {slices.map((sl, i) => (
          <div
            key={i}
            className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ opacity: hovered !== null && hovered !== i ? 0.4 : 1 }}
          >
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sl.color }} />
            <span className="text-gray-700 font-medium truncate">{sl.category}</span>
            <span className="ml-auto text-gray-500 font-medium tabular-nums">{(sl.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
