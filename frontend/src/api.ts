import type { AppSettings, Job, Portal, Stats, TriggerResult } from './types';
import {
  DEMO_JOBS,
  DEMO_PORTALS,
  DEMO_SETTINGS,
  DEMO_STATS,
} from './demo';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/**
 * The frontend can run standalone on Vercel without a backend reachable.
 * On any network failure we transparently fall back to demo data so the
 * dashboard renders something realistic instead of "Failed to fetch".
 * The `isDemoMode()` selector lets the UI surface a banner explaining
 * the state.
 */
let demoMode = false;

export function isDemoMode(): boolean {
  return demoMode;
}

function setDemoMode(reason: string) {
  if (!demoMode) {
    demoMode = true;
    // eslint-disable-next-line no-console
    console.info('[GetJob] Demo mode active —', reason);
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function withDemoFallback<T>(
  call: () => Promise<T>,
  demoValue: () => T,
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    setDemoMode(err instanceof Error ? err.message : String(err));
    return demoValue();
  }
}

// In-memory demo state so star/dismiss/threshold edits feel real.
let demoJobs = DEMO_JOBS.map((j) => ({ ...j }));
let demoSettings = { ...DEMO_SETTINGS };
let demoPortals = DEMO_PORTALS.map((p) => ({ ...p }));

export const api = {
  listJobs: (minScore = 0, includeDismissed = false) =>
    withDemoFallback(
      () =>
        http<Job[]>(
          `/api/jobs?min_score=${minScore}&include_dismissed=${includeDismissed}`,
        ),
      () =>
        demoJobs.filter(
          (j) =>
            (j.relevance_score ?? 0) >= minScore &&
            (includeDismissed || !j.dismissed),
        ),
    ),

  updateJob: (id: number, body: Partial<Pick<Job, 'starred' | 'dismissed'>>) =>
    withDemoFallback(
      () =>
        http<Job>(`/api/jobs/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
      () => {
        demoJobs = demoJobs.map((j) =>
          j.id === id ? { ...j, ...body } : j,
        );
        return demoJobs.find((j) => j.id === id)!;
      },
    ),

  listPortals: () =>
    withDemoFallback(
      () => http<Portal[]>('/api/portals'),
      () => demoPortals,
    ),

  createPortal: (body: Omit<Portal, 'id' | 'last_scanned_at' | 'last_error' | 'created_at'>) =>
    withDemoFallback(
      () =>
        http<Portal>('/api/portals', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      () => {
        const portal: Portal = {
          ...body,
          id: Math.max(0, ...demoPortals.map((p) => p.id)) + 1,
          last_scanned_at: null,
          last_error: null,
          created_at: new Date().toISOString(),
        };
        demoPortals = [...demoPortals, portal];
        return portal;
      },
    ),

  deletePortal: (id: number) =>
    withDemoFallback(
      () => http<void>(`/api/portals/${id}`, { method: 'DELETE' }),
      () => {
        demoPortals = demoPortals.filter((p) => p.id !== id);
        return undefined as unknown as void;
      },
    ),

  readSettings: () =>
    withDemoFallback(
      () => http<AppSettings>('/api/settings'),
      () => demoSettings,
    ),

  updateSettings: (body: Partial<AppSettings>) =>
    withDemoFallback(
      () =>
        http<AppSettings>('/api/settings', {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
      () => {
        demoSettings = { ...demoSettings, ...body };
        return demoSettings;
      },
    ),

  triggerScan: () =>
    withDemoFallback(
      () =>
        http<TriggerResult>('/api/trigger-scan', { method: 'POST' }),
      () => ({
        status: 'demo',
        portals_scraped: demoPortals.length,
        scrape_errors: 0,
        jobs_scored: demoJobs.length,
        digest_jobs_included: demoJobs.filter(
          (j) => (j.relevance_score ?? 0) >= demoSettings.relevance_threshold,
        ).length,
      }),
    ),

  stats: () =>
    withDemoFallback(
      () => http<Stats>('/api/stats'),
      () => ({
        ...DEMO_STATS,
        high_match_jobs: demoJobs.filter(
          (j) => (j.relevance_score ?? 0) >= demoSettings.relevance_threshold,
        ).length,
        portals_active: demoPortals.filter((p) => p.is_active).length,
      }),
    ),
};
