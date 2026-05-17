import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, isDemoMode } from './api';
import type { AppSettings, Job, Portal, Stats } from './types';
import { Filters } from './components/Filters';
import { DemoBanner, Header, Hero } from './components/Header';
import { Icon } from './components/Icon';
import { JobList } from './components/JobList';
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);

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
      setDemo(isDemoMode());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [minScore, includeDismissed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (scanToast) {
      const t = setTimeout(() => setScanToast(null), 4_000);
      return () => clearTimeout(t);
    }
  }, [scanToast]);

  async function triggerScan() {
    setScanning(true);
    setError(null);
    try {
      const r = await api.triggerScan();
      setScanToast(
        r.status === 'demo'
          ? `Demo scan: ${r.portals_scraped} portals · ${r.jobs_scored} scored`
          : `Scan complete: ${r.jobs_scored} scored · ${r.digest_jobs_included} above threshold`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  const filteredJobs = useMemo(() => {
    if (!search) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q),
    );
  }, [jobs, search]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header
        tab={tab}
        onTabChange={setTab}
        settings={settings}
        scanning={scanning}
        onScan={triggerScan}
      />
      <DemoBanner show={demo} />
      {tab === 'jobs' && (
        <Hero
          total={stats?.total_jobs ?? null}
          high={stats?.high_match_jobs ?? null}
        />
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <Icon name="alert" size={14} />
            {error}
          </div>
        )}

        {tab === 'jobs' && (
          <div className="grid gap-5">
            <StatsCards stats={stats} />
            <Filters
              minScore={minScore}
              onMinScoreChange={setMinScore}
              includeDismissed={includeDismissed}
              onIncludeDismissedChange={setIncludeDismissed}
              search={search}
              onSearchChange={setSearch}
              count={filteredJobs.length}
              loading={loading}
            />
            <JobList jobs={filteredJobs} onChange={refresh} loading={loading} />
          </div>
        )}

        {tab === 'settings' && (
          <SettingsPanel settings={settings} portals={portals} onChange={refresh} />
        )}
      </main>

      {scanToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">
            <Icon name="check" size={14} className="text-emerald-400" />
            {scanToast}
          </div>
        </div>
      )}
    </div>
  );
}
