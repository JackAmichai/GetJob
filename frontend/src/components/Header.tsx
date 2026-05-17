import { Icon } from './Icon';
import { links } from '../api';
import type { AppSettings } from '../types';

type Tab = 'jobs' | 'settings';

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  settings: AppSettings | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function Header({ tab, onTabChange, settings, refreshing, onRefresh }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Icon name="logo" size={32} />
          <div>
            <div className="text-base font-bold tracking-tight text-zinc-900">
              GetJob
            </div>
            <div className="hidden text-[11px] font-medium text-zinc-500 sm:block">
              {settings?.default_location ?? '—'} · threshold{' '}
              {settings?.relevance_threshold ?? '—'}% · {settings?.scan_cron ?? '—'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <nav className="hidden rounded-full bg-zinc-100 p-1 text-sm sm:flex">
            {(['jobs', 'settings'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={`rounded-full px-4 py-1.5 font-medium capitalize transition-all ${
                  tab === t
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh dashboard data"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 disabled:opacity-50"
          >
            <Icon
              name="refresh"
              size={14}
              className={refreshing ? 'animate-spin' : ''}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <a
            href={links.runWorkflow}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700"
          >
            <Icon name="play" size={14} />
            <span className="hidden sm:inline">Run scan</span>
            <Icon name="external" size={11} className="hidden sm:inline opacity-70" />
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-1 px-4 pb-2 sm:hidden">
        {(['jobs', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
              tab === t
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </header>
  );
}

interface HeroProps {
  total: number | null;
  high: number | null;
}

export function Hero({ total, high }: HeroProps) {
  return (
    <section className="hero-bg border-b border-zinc-200/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Icon name="sparkle" size={12} filled />
              Daily AI-ranked roles
            </div>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
              Every morning, the best{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                jobs for you
              </span>{' '}
              — already scored.
            </h1>
            <p className="mt-3 max-w-xl text-base text-zinc-600">
              Scrapes Workday, Greenhouse & Lever. Ranks each role against your
              CV across tech fit, seniority and geography. Sends a digest at 10:00.
            </p>
          </div>
          <div className="flex shrink-0 items-end gap-6">
            <div>
              <div className="text-3xl font-bold tabular-nums text-zinc-900 sm:text-4xl">
                {total ?? '—'}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Roles tracked
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums text-emerald-600 sm:text-4xl">
                {high ?? '—'}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Strong match
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface BannerProps {
  show: boolean;
  generatedAt: string | null;
}

export function FirstRunBanner({ show, generatedAt }: BannerProps) {
  if (!show) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-xs text-amber-900 sm:px-6">
        <Icon name="info" size={14} className="shrink-0" />
        <span className="flex-1">
          <strong className="font-semibold">No scan results yet.</strong>{' '}
          The daily cron runs at 10:00 Asia/Jerusalem. Trigger one now from{' '}
          <a
            href={links.runWorkflow}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline hover:text-amber-700"
          >
            GitHub Actions ↗
          </a>
          .
        </span>
        {generatedAt && (
          <span className="hidden text-amber-700 sm:inline">
            Last build: {new Date(generatedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
