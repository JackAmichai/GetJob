import type { AppSettings, Job, Portal, Stats, TriggerResult } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

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

export const api = {
  listJobs: (minScore = 0, includeDismissed = false) =>
    http<Job[]>(`/api/jobs?min_score=${minScore}&include_dismissed=${includeDismissed}`),
  updateJob: (id: number, body: Partial<Pick<Job, 'starred' | 'dismissed'>>) =>
    http<Job>(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  listPortals: () => http<Portal[]>('/api/portals'),
  createPortal: (body: Omit<Portal, 'id' | 'last_scanned_at' | 'last_error' | 'created_at'>) =>
    http<Portal>('/api/portals', { method: 'POST', body: JSON.stringify(body) }),
  deletePortal: (id: number) =>
    http<void>(`/api/portals/${id}`, { method: 'DELETE' }),
  readSettings: () => http<AppSettings>('/api/settings'),
  updateSettings: (body: Partial<AppSettings>) =>
    http<AppSettings>('/api/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  triggerScan: () => http<TriggerResult>('/api/trigger-scan', { method: 'POST' }),
  stats: () => http<Stats>('/api/stats'),
};
