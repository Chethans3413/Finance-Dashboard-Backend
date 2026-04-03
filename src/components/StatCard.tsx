import { cx } from '../lib/api';

export default function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  return (
    <div
      className={cx(
        'glass-card p-5 border-l-4',
        tone === 'good' && 'border-l-[#B3FF4C]',
        tone === 'bad' && 'border-l-red-500',
        tone === 'neutral' && 'border-l-gray-300'
      )}
    >
      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-gray-400 font-medium">{hint}</div> : null}
    </div>
  );
}
