import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, dataGeneratedAt, isDataMissing } from './api';
import type { AppSettings, Job, Portal, Stats } from './types';
import { Filters } from './components/Filters';
import { FirstRunBanner, Header, Hero } from './components/Header';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstRun, setFirstRun] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const refresh = useCallback(
    async (hard = false) => {
      if (hard) {
        setRefreshing(true);
        await api.refresh();
      } else {
        setLoading(true);
      }
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
        setFirstRun(isDataMissing());
        setGeneratedAt(dataGeneratedAt());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [minScore, includeDismissed],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

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
        refreshing={refreshing}
        onRefresh={() => refresh(true)}
      />
      <FirstRunBanner show={firstRun} generatedAt={generatedAt} />
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
          <SettingsPanel settings={settings} portals={portals} />
        )}
      </main>
    </div>
  );
}
