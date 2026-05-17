import type { AppSettings, Portal } from '../types';
import { links } from '../api';
import { Icon } from './Icon';

interface Props {
  settings: AppSettings | null;
  portals: Portal[];
}

export function SettingsPanel({ settings, portals }: Props) {
  if (!settings) {
    return (
      <div className="grid gap-4">
        <div className="h-40 animate-pulse rounded-2xl border border-zinc-200/80 bg-white" />
        <div className="h-60 animate-pulse rounded-2xl border border-zinc-200/80 bg-white" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <ArchitectureCard />

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name="cog" size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Operational settings
              </h2>
              <p className="text-xs text-zinc-500">
                Live values from the last scan run
              </p>
            </div>
          </div>
          <a
            href={links.editWorkflow}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Edit on GitHub
            <Icon name="external" size={11} />
          </a>
        </header>

        <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          <ReadonlyField icon="location" label="Default location" value={settings.default_location} />
          <ReadonlyField icon="mail" label="Notification email" value={settings.default_email} />
          <ReadonlyField icon="sparkle" label="Relevance threshold" value={`${settings.relevance_threshold}%`} />
          <ReadonlyField icon="calendar" label="Scan cron" value={settings.scan_cron} mono />
          <ReadonlyField icon="sparkle" label="LLM provider" value={settings.llm_provider} mono />
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Icon name="building" size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Portals</h2>
              <p className="text-xs text-zinc-500">
                {portals.length} configured · {portals.filter((p) => p.is_active).length} active
              </p>
            </div>
          </div>
          <a
            href={links.editPortals}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Edit on GitHub
            <Icon name="external" size={11} />
          </a>
        </header>

        <ul className="divide-y divide-zinc-100">
          {portals.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900">{p.name}</span>
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    {p.ats_type}
                  </span>
                  {p.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Paused
                    </span>
                  )}
                </div>
                <a
                  href={p.board_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate text-xs text-brand-600 hover:underline"
                >
                  {p.board_url}
                </a>
                {p.last_error && (
                  <div className="mt-1 inline-flex items-start gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                    <Icon name="alert" size={12} className="mt-0.5" />
                    {p.last_error}
                  </div>
                )}
                {p.last_scanned_at && !p.last_error && (
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    Last scanned {new Date(p.last_scanned_at).toLocaleString()}
                  </div>
                )}
              </div>
            </li>
          ))}
          {portals.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-zinc-500">
              No portals yet. Click <strong>Edit on GitHub</strong> to add some.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function ArchitectureCard() {
  return (
    <section className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon name="sparkle" size={16} filled />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-zinc-900">
            How this dashboard updates
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">
            Every day at 10:00 (Asia/Jerusalem) a GitHub Action scrapes the
            configured boards, scores each role against your CV, emails the
            digest, and commits the fresh{' '}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">data.json</code>{' '}
            back to the repo. Vercel auto-rebuilds. No backend server.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <a
              href={links.runWorkflow}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 font-semibold text-white hover:bg-zinc-700"
            >
              <Icon name="play" size={11} />
              Trigger a scan now
              <Icon name="external" size={11} />
            </a>
            <a
              href={links.editCV}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Edit CV
              <Icon name="external" size={11} />
            </a>
            <a
              href={links.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Open repo
              <Icon name="external" size={11} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

interface ROProps {
  label: string;
  value: string;
  icon?: import('./Icon').IconName;
  mono?: boolean;
}

function ReadonlyField({ label, value, icon, mono }: ROProps) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
        {icon && <Icon name={icon} size={12} className="text-zinc-400" />}
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-sm font-semibold text-zinc-900 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
