import type { AppSettings, Job, Portal, Stats } from './types';

/**
 * Static-file data source.
 *
 * The dashboard reads `/data.json`, which is regenerated daily by the
 * GitHub Actions cron and committed back to the repo (so Vercel
 * auto-rebuilds with fresh data).
 *
 * There's no backend server. User actions (star/dismiss) are stored
 * locally in browser localStorage and overlaid on the JSON jobs.
 */
type LocalAction = { starred?: boolean; dismissed?: boolean };
type LocalState = Record<string, LocalAction>;

const STORAGE_KEY = 'getjob:actions:v1';
const DATA_URL = (import.meta.env.VITE_DATA_URL ?? '/data.json') as string;

function loadLocal(): LocalState {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocal(state: LocalState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface RawData {
  version: number;
  generated_at: string;
  settings: AppSettings;
  stats: Stats;
  portals: Portal[];
  jobs: Job[];
}

let cache: RawData | null = null;
let cachePromise: Promise<RawData> | null = null;
let dataMissing = false;

export function isDataMissing(): boolean {
  return dataMissing;
}

export function dataGeneratedAt(): string | null {
  return cache?.generated_at ?? null;
}

async function loadData(force = false): Promise<RawData> {
  if (cache && !force) return cache;
  if (cachePromise && !force) return cachePromise;
  cachePromise = (async () => {
    try {
      const res = await fetch(DATA_URL, { cache: force ? 'no-store' : 'default' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as RawData;
      dataMissing = data.jobs.length === 0 && data.portals.length === 0;
      cache = data;
      return data;
    } catch (err) {
      dataMissing = true;
      cache = emptyData();
      console.warn('[GetJob] data.json missing — first scan has not run yet', err);
      return cache;
    } finally {
      cachePromise = null;
    }
  })();
  return cachePromise;
}

function emptyData(): RawData {
  return {
    version: 1,
    generated_at: '',
    settings: {
      default_location: 'Israel',
      default_email: 'jackamichai@gmail.com',
      relevance_threshold: 75,
      scan_cron: '0 10 * * *',
      llm_provider: 'anthropic',
    },
    stats: {
      total_jobs: 0,
      scored_jobs: 0,
      high_match_jobs: 0,
      portals_active: 0,
      last_scan_at: null,
    },
    portals: [],
    jobs: [],
  };
}

function applyLocal(jobs: Job[], state: LocalState): Job[] {
  return jobs.map((j) => {
    const local = state[String(j.id)] ?? state[j.url];
    if (!local) return j;
    return {
      ...j,
      starred: local.starred ?? j.starred,
      dismissed: local.dismissed ?? j.dismissed,
    };
  });
}

export const api = {
  async listJobs(minScore = 0, includeDismissed = false): Promise<Job[]> {
    const data = await loadData();
    const local = loadLocal();
    return applyLocal(data.jobs, local)
      .filter(
        (j) =>
          (j.relevance_score ?? 0) >= minScore &&
          (includeDismissed || !j.dismissed),
      );
  },

  async updateJob(
    id: number,
    body: Partial<Pick<Job, 'starred' | 'dismissed'>>,
  ): Promise<Job> {
    const data = await loadData();
    const job = data.jobs.find((j) => j.id === id);
    if (!job) throw new Error(`Job ${id} not found`);
    const state = loadLocal();
    const key = String(id);
    state[key] = { ...(state[key] || {}), ...body };
    saveLocal(state);
    return { ...job, ...body };
  },

  async listPortals(): Promise<Portal[]> {
    const data = await loadData();
    return data.portals;
  },

  async readSettings(): Promise<AppSettings> {
    const data = await loadData();
    return data.settings;
  },

  async stats(): Promise<Stats> {
    const data = await loadData();
    const local = loadLocal();
    const jobs = applyLocal(data.jobs, local);
    return {
      ...data.stats,
      high_match_jobs: jobs.filter(
        (j) =>
          (j.relevance_score ?? 0) >= data.settings.relevance_threshold &&
          !j.dismissed,
      ).length,
    };
  },

  async refresh(): Promise<void> {
    await loadData(true);
  },
};

/**
 * GitHub Actions URLs used by the dashboard for manual triggers and editing.
 * VITE_GITHUB_REPO override lets you fork without code edits.
 */
const REPO = (import.meta.env.VITE_GITHUB_REPO ?? 'JackAmichai/GetJob') as string;
export const links = {
  runWorkflow: `https://github.com/${REPO}/actions/workflows/daily-scan.yml`,
  editPortals: `https://github.com/${REPO}/edit/main/config/portals.json`,
  editCV: `https://github.com/${REPO}/edit/main/backend/app/cv_data.py`,
  editWorkflow: `https://github.com/${REPO}/edit/main/.github/workflows/daily-scan.yml`,
  repo: `https://github.com/${REPO}`,
};
