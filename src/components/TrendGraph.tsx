import React from 'react';
import { formatCurrency } from '../lib/format';

type Trend = { period: string; type: string; total: number };

export default function TrendGraph({ data }: { data: Trend[] }) {
  if (!data || data.length === 0) return <div className="text-sm text-gray-500">No trend data.</div>;
  const max = Math.max(...data.map((d) => d.total), 0);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center">
          <div className="w-20 text-xs text-gray-500">{d.period}</div>
          <div className="flex-1 h-4 bg-emerald-500/30 rounded" style={{ width: `${(d.total / max) * 100}%` }} />
          <div className="ml-2 text-sm tabular-nums text-gray-900">{formatCurrency(d.total)}</div>
        </div>
      ))}
    </div>
  );
}
