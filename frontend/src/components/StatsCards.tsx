import type { Stats } from '../types';

interface Props {
  stats: Stats | null;
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const cards: Array<{ key: keyof Stats; label: string; tint: string }> = [
  { key: 'total_jobs', label: 'Total jobs', tint: 'text-zinc-900' },
  { key: 'scored_jobs', label: 'Scored', tint: 'text-blue-600' },
  { key: 'high_match_jobs', label: 'High match', tint: 'text-emerald-600' },
  { key: 'portals_active', label: 'Active portals', tint: 'text-violet-600' },
];

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cards.map((c) => (
        <div key={c.key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</div>
          <div className={`mt-1 text-2xl font-bold ${c.tint}`}>
            {stats ? (stats[c.key] as number) : '—'}
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Last scan</div>
        <div className="mt-1 text-sm font-semibold text-zinc-700">
          {stats ? formatRelative(stats.last_scan_at) : '—'}
        </div>
      </div>
    </div>
  );
}
