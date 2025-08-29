import React, { useEffect, useMemo, useState } from 'react';

export type ImportProfile = {
  id: string;
  browser: string;
  name: string;
  paths: Record<string, string | undefined>;
};

export type ImportPreview = {
  profileId: string;
  browser: string;
  counts: Record<string, number | undefined>;
  notes?: string[];
};

export type ImportRunResult = {
  profileId: string;
  browser: string;
  imported: Record<string, number>;
  errors?: string[];
};

export function ImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<{ history: boolean; bookmarks: boolean; cookies: boolean; passwords: boolean; limit?: number }>({
    history: true,
    bookmarks: true,
    cookies: false,
    passwords: false,
    limit: undefined,
  });

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [skipNextTime, setSkipNextTime] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function detect() {
      setError(null);
      setPreview(null);
      setResult(null);
      setNotes([]);
      setSelectedProfileId('');
      setLoadingProfiles(true);
      try {
        const res = await window.comet.import.detectProfiles();
        if (cancelled) return;
        const list = Array.isArray(res) ? res : [];
        // Prefer Firefox first, then Chrome/Brave
        list.sort((a, b) => (a.browser || '').localeCompare(b.browser || ''));
        setProfiles(list as any);
        // Preselect first profile if available
        if (list.length) setSelectedProfileId(list[0].id);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    }
    detect();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!selectedProfileId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    async function loadPreview() {
      setError(null);
      setLoadingPreview(true);
      setPreview(null);
      setResult(null);
      try {
        const p = await window.comet.import.preview(selectedProfileId);
        if (cancelled) return;
        setPreview(p as any);
        setNotes(p?.notes || []);
        const c = (p?.counts || {}) as Record<string, number | undefined>;
        // Default toggles: history/bookmarks on if >0, cookies/passwords off (privacy), sessions off by default
        setOptions((prev) => ({
          history: (c.history || 0) > 0,
          bookmarks: (c.bookmarks || 0) > 0,
          cookies: false,
          passwords: false,
          sessions: false,
          limit: prev.limit,
        }));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    loadPreview();
    return () => { cancelled = true; };
  }, [open, selectedProfileId]);

  const canImport = useMemo(() => {
    if (!selectedProfileId || running) return false;
    const anySelected = options.history || options.bookmarks || options.cookies || options.passwords;
    return !!anySelected;
  }, [selectedProfileId, options, running]);

  const totalPreview = useMemo(() => {
    const c = preview?.counts || {};
    const keys = ['history', 'bookmarks', 'cookies', 'passwords'] as const;
    return keys.reduce((acc, k) => acc + (c[k] || 0), 0);
  }, [preview]);

  async function runImport() {
    if (!selectedProfileId) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await window.comet.import.run(selectedProfileId, {
        history: options.history,
        bookmarks: options.bookmarks,
        cookies: options.cookies,
        passwords: options.passwords,
        limit: options.limit,
      });
      setResult(res as any);
      // Mark onboarding as completed after a successful import run
      try {
        const total = Object.values(res?.imported || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        if (total > 0) {
          await window.comet.onboarding.set({ importCompleted: true, showImportOnFirstRun: false });
        }
      } catch {}
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setRunning(false);
    }
  }

  async function finish() {
    try {
      if (skipNextTime) await window.comet.onboarding.set({ showImportOnFirstRun: false });
      if (result) {
        const total = Object.values(result.imported || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        if (total > 0) await window.comet.onboarding.set({ importCompleted: true, showImportOnFirstRun: false });
      }
    } catch {}
    setResult(null);
    setError(null);
    onClose();
  }

  if (!open) return null;

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => { if (!running) finish(); }} />

      {/* Dialog */}
      <div className="absolute inset-x-0 top-8 mx-auto max-w-4xl">
        <div className="mx-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="font-semibold text-gray-900 dark:text-gray-100">Import Browser Data</div>
            <button
              className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              onClick={finish}
              disabled={running}
            >
              Close
            </button>
          </div>

          {/* Body */}
          <div className="p-4 grid gap-4">
            {/* Profiles */}
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">1. Select a browser profile</div>
              {loadingProfiles ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Detecting profiles…</div>
              ) : profiles.length ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {profiles.map((p) => (
                    <label key={p.id} className={`flex items-start gap-2 p-3 rounded border cursor-pointer transition ${
                      selectedProfileId === p.id ? 'border-emerald-500 ring-1 ring-emerald-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                      <input
                        type="radio"
                        name="import-profile"
                        className="mt-1"
                        checked={selectedProfileId === p.id}
                        onChange={() => setSelectedProfileId(p.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {p.browser} • {p.name || p.id}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {Object.entries(p.paths || {})
                            .filter(([, v]) => !!v)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')
                          }
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">No profiles found on this system.</div>
              )}
            </div>

            {/* Preview */}
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">2. Review what will be imported</div>
              {loadingPreview ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Loading preview…</div>
              ) : preview ? (
                <div className="grid gap-3">
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    From <span className="font-medium">{selectedProfile?.browser}</span> • <span className="font-mono">{selectedProfile?.name || selectedProfile?.id}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['history','bookmarks','cookies','passwords'] as const).map((k) => (
                      <div key={k} className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
                        <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">{k}</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{preview.counts?.[k] ?? 0}</div>
                      </div>
                    ))}
                  </div>
                  {!!notes.length && (
                    <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                      {notes.map((n, i) => (
                        <div key={i}>• {n}</div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total items detected: {totalPreview}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">Select a profile to view counts.</div>
              )}
            </div>

            {/* Options */}
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">3. Choose what to import</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200" htmlFor="imp-history">
                  <input id="imp-history" type="checkbox" checked={options.history} onChange={(e) => setOptions({ ...options, history: e.target.checked })} />
                  <span>History</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200" htmlFor="imp-bookmarks">
                  <input id="imp-bookmarks" type="checkbox" checked={options.bookmarks} onChange={(e) => setOptions({ ...options, bookmarks: e.target.checked })} />
                  <span>Bookmarks</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200" htmlFor="imp-cookies">
                  <input id="imp-cookies" type="checkbox" checked={options.cookies} onChange={(e) => setOptions({ ...options, cookies: e.target.checked })} />
                  <span>Cookies</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200" htmlFor="imp-passwords">
                  <input id="imp-passwords" type="checkbox" checked={options.passwords} onChange={(e) => setOptions({ ...options, passwords: e.target.checked })} />
                  <span>Passwords</span>
                </label>
                {/* Sessions import is not supported; removed to avoid confusion */}
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-700 dark:text-gray-300">Limit</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="unlimited"
                    className="w-28 px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    value={options.limit ?? ''}
                    onChange={(e) => setOptions({ ...options, limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              {error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : result ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                  <div className="text-sm text-emerald-700">
                    Imported: {Object.entries(result.imported || {})
                      .filter(([, v]) => (v as number) > 0)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ') || 'nothing'}
                    {Array.isArray(result.errors) && result.errors.length ? (
                      <span className="ml-2 text-red-600">(errors: {result.errors.length})</span>
                    ) : null}
                  </div>
                  {(result.imported?.cookies ?? 0) > 0 && (
                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                      <span className="text-xs text-gray-700 dark:text-gray-300">Apply cookies:</span>
                      <button
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => window.comet.navigate('https://accounts.google.com/')}
                      >Open accounts.google.com</button>
                      <button
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => window.comet.navigate('https://www.google.com/')}
                      >Open google.com</button>
                    </div>
                  )}
                </div>
              ) : <div />}
              <label className="text-xs flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={skipNextTime} onChange={(e) => setSkipNextTime(e.target.checked)} /> Don't show again
              </label>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 border rounded text-sm border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={finish}
                  disabled={running}
                >
                  Done
                </button>
                <button
                  className={`px-3 py-2 rounded text-sm text-white ${canImport ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/60 cursor-not-allowed'}`}
                  disabled={!canImport}
                  onClick={runImport}
                >
                  {running ? 'Importing…' : 'Import selected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
