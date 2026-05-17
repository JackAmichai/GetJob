import { Fragment, useState } from 'react';
import type { Job } from '../types';
import { ScoreBadge } from './ScoreBadge';
import { api } from '../api';

interface Props {
  jobs: Job[];
  onChange: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function JobTable({ jobs, onChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  async function toggle(id: number, field: 'starred' | 'dismissed', value: boolean) {
    try {
      await api.updateJob(id, { [field]: value });
      onChange();
    } catch (err) {
      console.error(err);
    }
  }

  if (!jobs.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
        No jobs yet. Add portals in <span className="font-medium">Settings</span> and trigger a scan.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-3 text-left">Score</th>
            <th className="px-3 py-3 text-left">Role</th>
            <th className="px-3 py-3 text-left">Company</th>
            <th className="px-3 py-3 text-left">Location</th>
            <th className="px-3 py-3 text-left">Scraped</th>
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {jobs.map((job) => (
            <Fragment key={job.id}>
              <tr
                className={`cursor-pointer transition-colors hover:bg-zinc-50 ${
                  job.dismissed ? 'opacity-50' : ''
                }`}
                onClick={() => setExpanded(expanded === job.id ? null : job.id)}
              >
                <td className="px-3 py-3 whitespace-nowrap">
                  <ScoreBadge score={job.relevance_score} />
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-zinc-900">{job.title}</div>
                  <div className="text-xs text-zinc-500">
                    T:{job.tech_score ?? '—'} · X:{job.experience_score ?? '—'} · G:
                    {job.geography_score ?? '—'}
                  </div>
                </td>
                <td className="px-3 py-3 text-zinc-700">{job.company}</td>
                <td className="px-3 py-3 text-zinc-600">{job.location || '—'}</td>
                <td className="px-3 py-3 text-zinc-500">{formatDate(job.scraped_at)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(job.id, 'starred', !job.starred);
                    }}
                    className={`mr-1 rounded px-2 py-1 text-xs transition-colors ${
                      job.starred
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'text-zinc-400 hover:text-yellow-600'
                    }`}
                    title={job.starred ? 'Unstar' : 'Star'}
                  >
                    ★
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(job.id, 'dismissed', !job.dismissed);
                    }}
                    className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-rose-600"
                    title={job.dismissed ? 'Restore' : 'Dismiss'}
                  >
                    {job.dismissed ? '↺' : '✕'}
                  </button>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-1 rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                  >
                    Open
                  </a>
                </td>
              </tr>
              {expanded === job.id && (
                <tr className="bg-zinc-50/70">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Brief
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700">
                      {job.brief || 'No brief available.'}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
