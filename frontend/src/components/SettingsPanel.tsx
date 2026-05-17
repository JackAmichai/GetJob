import { useEffect, useState } from 'react';
import type { AppSettings, Portal } from '../types';
import { api } from '../api';
import { Icon } from './Icon';

interface Props {
  settings: AppSettings | null;
  portals: Portal[];
  onChange: () => void;
}

const ATS_OPTIONS = ['greenhouse', 'lever', 'workday', 'generic'] as const;
const ATS_LABEL: Record<(typeof ATS_OPTIONS)[number], string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
  generic: 'Generic',
};

export function SettingsPanel({ settings, portals, onChange }: Props) {
  const [draft, setDraft] = useState<Partial<AppSettings>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(false), 2200);
      return () => clearTimeout(t);
    }
  }, [success]);

  if (!settings) {
    return (
      <div className="grid gap-4">
        <div className="h-40 animate-pulse rounded-2xl border border-zinc-200/80 bg-white" />
        <div className="h-60 animate-pulse rounded-2xl border border-zinc-200/80 bg-white" />
      </div>
    );
  }

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      await api.updateSettings(draft);
      setDraft({});
      setSuccess(true);
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
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-card">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name="cog" size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Operational settings
              </h2>
              <p className="text-xs text-zinc-500">
                Live overrides — persisted to <code className="rounded bg-zinc-100 px-1 font-mono text-[10px]">user_settings</code>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            <Icon name="sparkle" size={10} filled />
            {settings.llm_provider}
          </span>
        </header>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Default location"
            icon="location"
            value={merged.default_location}
            placeholder="Israel, Berlin, Remote (EMEA), …"
            onChange={(v) => setDraft({ ...draft, default_location: v })}
          />
          <Field
            label="Notification email"
            icon="mail"
            type="email"
            value={merged.default_email}
            onChange={(v) => setDraft({ ...draft, default_email: v })}
          />
          <div>
            <FieldLabel icon="sparkle">
              Relevance threshold ({merged.relevance_threshold}%)
            </FieldLabel>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={merged.relevance_threshold}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  relevance_threshold: Number(e.target.value),
                })
              }
              className="mt-3 h-1 w-full cursor-pointer accent-brand-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <Field
            label="Scan cron (5-field)"
            icon="calendar"
            value={merged.scan_cron}
            mono
            onChange={(v) => setDraft({ ...draft, scan_cron: v })}
          />
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-5 py-3">
          {error && (
            <span className="text-xs font-medium text-rose-600">{error}</span>
          )}
          {success && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Icon name="check" size={12} />
              Saved
            </span>
          )}
          {dirty && !error && !success && (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <Icon name="refresh" size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Icon name="check" size={14} />
                Save settings
              </>
            )}
          </button>
        </footer>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-card">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
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
        </header>

        <div className="border-b border-zinc-100 bg-zinc-50/50 p-4">
          <div className="grid gap-2 sm:grid-cols-12">
            <input
              placeholder="Display name"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none sm:col-span-3"
              value={newPortal.name}
              onChange={(e) => setNewPortal({ ...newPortal, name: e.target.value })}
            />
            <input
              placeholder="Company"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none sm:col-span-2"
              value={newPortal.company}
              onChange={(e) => setNewPortal({ ...newPortal, company: e.target.value })}
            />
            <input
              placeholder="Board URL"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none sm:col-span-4"
              value={newPortal.board_url}
              onChange={(e) => setNewPortal({ ...newPortal, board_url: e.target.value })}
            />
            <select
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-2"
              value={newPortal.ats_type}
              onChange={(e) =>
                setNewPortal({
                  ...newPortal,
                  ats_type: e.target.value as Portal['ats_type'],
                })
              }
            >
              {ATS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {ATS_LABEL[t]}
                </option>
              ))}
            </select>
            <button
              onClick={addPortal}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:col-span-1"
            >
              <Icon name="plus" size={14} />
              Add
            </button>
          </div>
        </div>

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
              </div>
              <button
                onClick={() => removePortal(p.id)}
                title="Delete portal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
          {portals.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-zinc-500">
              No portals yet. Add your first above.
            </li>
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
  icon?: import('./Icon').IconName;
  mono?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}

function Field({ label, value, type = 'text', icon, mono, placeholder, onChange }: FieldProps) {
  return (
    <label className="block">
      <FieldLabel icon={icon}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:outline-none ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  );
}

function FieldLabel({
  icon,
  children,
}: {
  icon?: import('./Icon').IconName;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
      {icon && <Icon name={icon} size={12} className="text-zinc-400" />}
      {children}
    </span>
  );
}
