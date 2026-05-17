import { useState } from 'react';
import type { Job } from '../types';
import { api } from '../api';
import { Icon } from './Icon';
import { MiniBar, ScoreRing } from './ScoreRing';

interface Props {
  jobs: Job[];
  onChange: () => void;
  loading: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function tierLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 85) return 'Strong match';
  if (score >= 75) return 'Good match';
  if (score >= 50) return 'Possible';
  return 'Weak';
}

export function JobList({ jobs, onChange, loading }: Props) {
  if (loading && jobs.length === 0) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-zinc-200/80 bg-white"
          />
        ))}
      </div>
    );
  }

  if (!jobs.length) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-3">
      {jobs.map((job, i) => (
        <JobCard key={job.id} job={job} index={i} onChange={onChange} />
      ))}
    </div>
  );
}

interface CardProps {
  job: Job;
  index: number;
  onChange: () => void;
}

function JobCard({ job, index, onChange }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);

  async function toggle(field: 'starred' | 'dismissed', value: boolean) {
    setPending(true);
    try {
      await api.updateJob(job.id, { [field]: value });
      onChange();
    } finally {
      setPending(false);
    }
  }

  const score = job.relevance_score;
  const tier = tierLabel(score);
  const tierClass =
    score === null
      ? 'bg-zinc-100 text-zinc-600'
      : score >= 85
      ? 'bg-emerald-50 text-emerald-700'
      : score >= 75
      ? 'bg-amber-50 text-amber-700'
      : score >= 50
      ? 'bg-orange-50 text-orange-700'
      : 'bg-slate-100 text-slate-600';

  const briefLines = (job.brief || '')
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-card transition-all animate-slide-up ${
        job.dismissed ? 'opacity-55' : 'hover:-translate-y-0.5 hover:shadow-card-hover'
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:gap-6">
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-start">
          <ScoreRing score={score} size={72} thickness={7} />
          <div
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tierClass}`}
          >
            {tier}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-bold leading-snug text-zinc-900">
              {job.title}
            </h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-800">
              <Icon name="building" size={14} className="text-zinc-400" />
              {job.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="location" size={14} className="text-zinc-400" />
              {job.location || 'Unspecified'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={14} className="text-zinc-400" />
              {formatDate(job.scraped_at)}
            </span>
            {job.starred && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <Icon name="star" size={11} filled />
                Starred
              </span>
            )}
          </div>

          {briefLines.length > 0 && (
            <ul
              className={`mt-3 space-y-1 text-sm text-zinc-700 ${
                expanded ? '' : 'line-clamp-2'
              }`}
            >
              {briefLines.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}

          {briefLines.length > 2 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              {expanded ? 'Show less' : `Show all ${briefLines.length} points`}
            </button>
          )}

          <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
            <MiniBar label="Tech" value={job.tech_score} />
            <MiniBar label="Experience" value={job.experience_score} />
            <MiniBar label="Geo" value={job.geography_score} />
          </div>
        </div>

        <div className="flex flex-row items-start gap-2 sm:flex-col sm:items-end">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-700"
          >
            Open
            <Icon name="external" size={12} />
          </a>
          <div className="flex gap-1">
            <button
              onClick={() => toggle('starred', !job.starred)}
              disabled={pending}
              title={job.starred ? 'Unstar' : 'Star'}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all disabled:opacity-50 ${
                job.starred
                  ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : 'border-zinc-200 bg-white text-zinc-400 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              <Icon name="star" size={14} filled={job.starred} />
            </button>
            <button
              onClick={() => toggle('dismissed', !job.dismissed)}
              disabled={pending}
              title={job.dismissed ? 'Restore' : 'Dismiss'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 transition-all hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
            >
              <Icon name={job.dismissed ? 'undo' : 'x'} size={14} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon name="search" size={26} />
      </div>
      <h3 className="text-base font-bold text-zinc-900">No matches yet</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Add a portal in Settings and hit{' '}
        <span className="font-semibold text-zinc-700">Run scan</span> to start
        building your daily feed.
      </p>
    </div>
  );
}
