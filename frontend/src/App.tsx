import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { AppSettings, Job, Portal, Stats } from './types';
import { JobTable } from './components/JobTable';
import { SettingsPanel } from './components/SettingsPanel';
import { StatsCards } from './components/StatsCards';

type Tab = 'jobs' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, p, s, st] = await Promise.all([
        api.listJobs(minScore, includeDismissed),
        api.listPortals(),
        api.readSettings(),
        api.stats(),
      ]);
      setJobs(j);
      setPortals(p);
      setSettings(s);
      setStats(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [minScore, includeDismissed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function triggerScan() {
    setScanning(true);
    setError(null);
    try {
      await api.triggerScan();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold">GetJob</h1>
            <p className="text-xs text-zinc-500">
              Daily scan · {settings?.default_location ?? '—'} · threshold{' '}
              {settings?.relevance_threshold ?? '—'}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-lg bg-zinc-100 p-1 text-sm">
              {(['jobs', 'settings'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1 capitalize transition-colors ${
                    tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : 'Run scan'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <StatsCards stats={stats} />

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {tab === 'jobs' && (
          <section className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-zinc-600">Min score</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-32 accent-zinc-900"
                />
                <span className="w-10 text-right font-mono text-zinc-900">{minScore}%</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDismissed}
                  onChange={(e) => setIncludeDismissed(e.target.checked)}
                  className="accent-zinc-900"
                />
                <span className="text-zinc-600">Include dismissed</span>
              </label>
              <span className="ml-auto text-xs text-zinc-500">
                {loading ? 'Loading…' : `${jobs.length} job${jobs.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <JobTable jobs={jobs} onChange={refresh} />
          </section>
        )}

        {tab === 'settings' && (
          <section className="mt-6">
            <SettingsPanel settings={settings} portals={portals} onChange={refresh} />
          </section>
        )}
      </main>
    </div>
  );
}
