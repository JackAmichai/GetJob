interface Props {
  score: number | null;
  size?: number;
  thickness?: number;
}

/** Circular SVG progress ring showing the relevance score. */
export function ScoreRing({ score, size = 64, thickness = 6 }: Props) {
  const value = score ?? 0;
  const tier =
    value >= 85
      ? { ring: '#10b981', text: '#047857', track: '#d1fae5' }   // emerald
      : value >= 75
      ? { ring: '#f59e0b', text: '#b45309', track: '#fef3c7' }   // amber
      : value >= 50
      ? { ring: '#f97316', text: '#c2410c', track: '#ffedd5' }   // orange
      : { ring: '#94a3b8', text: '#475569', track: '#e2e8f0' };  // slate

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tier.track}
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tier.ring}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={score === null ? c : offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-display font-bold tracking-tight"
        style={{
          color: tier.text,
          fontSize: size * 0.32,
        }}
      >
        {score === null ? '—' : value}
      </div>
    </div>
  );
}

interface MiniBarProps {
  label: string;
  value: number | null;
}

export function MiniBar({ label, value }: MiniBarProps) {
  const v = value ?? 0;
  const color =
    v >= 85
      ? 'bg-emerald-500'
      : v >= 60
      ? 'bg-amber-500'
      : v >= 30
      ? 'bg-orange-500'
      : 'bg-slate-400';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className="font-mono font-semibold text-zinc-700">
          {value === null ? '—' : v}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
