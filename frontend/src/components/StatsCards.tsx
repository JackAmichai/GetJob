import type { Stats } from '../types';
import { Icon } from './Icon';
import type { IconName } from './Icon';

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

interface CardDef {
  key: keyof Stats;
  label: string;
  icon: IconName;
  format: (v: Stats[keyof Stats]) => string;
  tint: string;
  iconBg: string;
}

const CARDS: CardDef[] = [
  {
    key: 'total_jobs',
    label: 'Total jobs',
    icon: 'briefcase',
    format: (v) => String(v ?? 0),
    tint: 'text-zinc-900',
    iconBg: 'bg-zinc-100 text-zinc-600',
  },
  {
    key: 'scored_jobs',
    label: 'Scored',
    icon: 'sparkle',
    format: (v) => String(v ?? 0),
    tint: 'text-brand-700',
    iconBg: 'bg-brand-50 text-brand-600',
  },
  {
    key: 'high_match_jobs',
    label: 'High match',
    icon: 'check',
    format: (v) => String(v ?? 0),
    tint: 'text-emerald-700',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'portals_active',
    label: 'Portals',
    icon: 'building',
    format: (v) => String(v ?? 0),
    tint: 'text-violet-700',
    iconBg: 'bg-violet-50 text-violet-600',
  },
  {
    key: 'last_scan_at',
    label: 'Last scan',
    icon: 'calendar',
    format: (v) => formatRelative(v as string | null),
    tint: 'text-zinc-900',
    iconBg: 'bg-amber-50 text-amber-600',
  },
];

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.iconBg}`}>
            <Icon name={c.icon} size={16} />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {c.label}
          </div>
          <div className={`mt-0.5 text-xl font-bold tabular-nums sm:text-2xl ${c.tint}`}>
            {stats ? c.format(stats[c.key]) : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}
