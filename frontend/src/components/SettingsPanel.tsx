import { useEffect, useState } from 'react';
import type { AppSettings, Portal } from '../types';
import { api } from '../api';

interface Props {
  settings: AppSettings | null;
  portals: Portal[];
  onChange: () => void;
}

const ATS_OPTIONS = ['greenhouse', 'lever', 'workday', 'generic'] as const;

export function SettingsPanel({ settings, portals, onChange }: Props) {
  const [draft, setDraft] = useState<Partial<AppSettings>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPortal, setNewPortal] = useState({
    name: '',
    company: '',
    board_url: '',
    ats_type: 'greenhouse' as Portal['ats_type'],
    is_active: true,
  });

  useEffect(() => {
    if (settings) setDraft({});
  }, [settings]);

  if (!settings) return null;

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      await api.updateSettings(draft);
      setDraft({});
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addPortal() {
    if (!newPortal.name || !newPortal.company || !newPortal.board_url) return;
    setError(null);
    try {
      await api.createPortal(newPortal);
      setNewPortal({ ...newPortal, name: '', company: '', board_url: '' });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function removePortal(id: number) {
    if (!confirm('Delete this portal and all its jobs?')) return;
    try {
      await api.deletePortal(id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const merged = { ...settings, ...draft };
  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Operational settings</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Mutable at runtime. Persisted to <code className="rounded bg-zinc-100 px-1">user_settings</code>.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Default location"
            value={merged.default_location}
            onChange={(v) => setDraft({ ...draft, default_location: v })}
          />
          <Field
            label="Notification email"
            type="email"
            value={merged.default_email}
            onChange={(v) => setDraft({ ...draft, default_email: v })}
          />
          <Field
            label="Relevance threshold (0-100)"
            type="number"
            value={String(merged.relevance_threshold)}
            onChange={(v) =>
              setDraft({ ...draft, relevance_threshold: Math.max(0, Math.min(100, Number(v) || 0)) })
            }
          />
          <Field
            label="Scan cron (5-field)"
            value={merged.scan_cron}
            onChange={(v) => setDraft({ ...draft, scan_cron: v })}
            hint={`LLM provider: ${settings.llm_provider}`}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={!dirty || saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Portals</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each portal is a target board (Workday tenant, Greenhouse slug, Lever site, or generic URL).
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <input
            placeholder="Display name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={newPortal.name}
            onChange={(e) => setNewPortal({ ...newPortal, name: e.target.value })}
          />
          <input
            placeholder="Company"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={newPortal.company}
            onChange={(e) => setNewPortal({ ...newPortal, company: e.target.value })}
          />
          <input
            placeholder="Board URL"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
            value={newPortal.board_url}
            onChange={(e) => setNewPortal({ ...newPortal, board_url: e.target.value })}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
              value={newPortal.ats_type}
              onChange={(e) =>
                setNewPortal({ ...newPortal, ats_type: e.target.value as Portal['ats_type'] })
              }
            >
              {ATS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={addPortal}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              +
            </button>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-zinc-100">
          {portals.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900">{p.name}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    {p.ats_type}
                  </span>
                </div>
                <a
                  href={p.board_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-blue-600 hover:underline"
                >
                  {p.board_url}
                </a>
                {p.last_error && (
                  <div className="mt-1 text-xs text-rose-600">⚠ {p.last_error}</div>
                )}
              </div>
              <button
                onClick={() => removePortal(p.id)}
                className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
              >
                Delete
              </button>
            </li>
          ))}
          {portals.length === 0 && (
            <li className="py-6 text-center text-sm text-zinc-500">No portals configured yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  type?: string;
  hint?: string;
  onChange: (v: string) => void;
}

function Field({ label, value, type = 'text', hint, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      {hint && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}
