import { Icon } from './Icon';

interface Props {
  minScore: number;
  onMinScoreChange: (v: number) => void;
  includeDismissed: boolean;
  onIncludeDismissedChange: (v: boolean) => void;
  search: string;
  onSearchChange: (v: string) => void;
  count: number;
  loading: boolean;
}

export function Filters({
  minScore,
  onMinScoreChange,
  includeDismissed,
  onIncludeDismissedChange,
  search,
  onSearchChange,
  count,
  loading,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-card sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, company, or location…"
            className="w-full rounded-xl border border-transparent bg-zinc-50 py-2.5 pl-10 pr-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2">
          <span className="text-xs font-semibold text-zinc-600">
            Min score
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => onMinScoreChange(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer accent-brand-600 sm:w-32"
          />
          <span className="w-9 text-right font-mono text-sm font-semibold tabular-nums text-zinc-900">
            {minScore}%
          </span>
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600">
          <input
            type="checkbox"
            checked={includeDismissed}
            onChange={(e) => onIncludeDismissedChange(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-brand-600"
          />
          Include dismissed
        </label>

        <div className="ml-auto text-xs font-medium text-zinc-500">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="refresh" size={11} className="animate-spin" />
              Loading…
            </span>
          ) : (
            <span>
              <span className="font-bold text-zinc-900">{count}</span>{' '}
              {count === 1 ? 'role' : 'roles'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
