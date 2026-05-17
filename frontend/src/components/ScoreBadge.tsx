interface Props {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, size = 'md' }: Props) {
  if (score === null) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-500">
        —
      </span>
    );
  }

  const palette =
    score >= 85
      ? 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30'
      : score >= 75
      ? 'bg-amber-500/15 text-amber-700 ring-amber-500/30'
      : score >= 50
      ? 'bg-orange-500/15 text-orange-700 ring-orange-500/30'
      : 'bg-rose-500/15 text-rose-700 ring-rose-500/30';

  const sizing =
    size === 'lg'
      ? 'px-3 py-1 text-base font-bold'
      : size === 'sm'
      ? 'px-1.5 py-0.5 text-xs font-medium'
      : 'px-2 py-0.5 text-sm font-semibold';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-1 ${palette} ${sizing}`}
    >
      {score}%
    </span>
  );
}
