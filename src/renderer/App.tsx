import React, { useEffect, useMemo, useState } from 'react';
import { ImportWizard } from './components/ImportWizard';

export function App() {
  const [omnibox, setOmnibox] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [tabs, setTabs] = useState<Array<{ id: string; title: string; url: string; active: boolean }>>([]);

  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<any[]>([]);

  const [prompt, setPrompt] = useState('Summarize this page.');
  const [includePage, setIncludePage] = useState(true);
  type ChatMsg = { role: 'user' | 'assistant'; content: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string>('searxng');
  const SIDEBAR_WIDTH = 420;
  const TABS_BAR_HEIGHT = 32; // px (Tailwind h-8)
  const TOOLBAR_HEIGHT = 64; // px (Tailwind h-16)
  const TOP_TOTAL = TABS_BAR_HEIGHT + TOOLBAR_HEIGHT; // 96
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  type SideMode = 'agent' | 'chat';
  const [sideMode, setSideMode] = useState<SideMode>('chat');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    window.comet.setLayout({ top: TOP_TOTAL, rightSidebarWidth: SIDEBAR_WIDTH }).catch(() => {});
    window.comet.getUrl().then((u) => {
      if (u) {
        setCurrentUrl(u);
        setOmnibox(u);
      }
    });
    window.comet.getSearchProvider().then((p) => setProvider(p)).catch(() => {});
    // First-run gating: open Import Wizard if configured and not completed
    window.comet.onboarding.get()
      .then((o) => {
        if (o && o.showImportOnFirstRun && !o.importCompleted) setShowImport(true);
      })
      .catch(() => {});
    const off = window.comet.onUrlChanged((url) => {
      setCurrentUrl(url || '');
      setOmnibox(url || '');
    });
    // Tabs wiring
    window.comet.tabs.list().then((t) => setTabs(t || [])).catch(() => {});
    const offTabsUpd = window.comet.tabs.onUpdated((t) => setTabs(t || []));
    const offTabsActive = window.comet.tabs.onActiveChanged((_e) => window.comet.tabs.list().then((t) => setTabs(t || [])).catch(() => {}));
    return () => {
      try { off(); } catch {}
      try { offTabsUpd(); } catch {}
      try { offTabsActive(); } catch {}
    };
  }, []);

  useEffect(() => {
    window.comet
      .setLayout({ top: TOP_TOTAL, rightSidebarWidth: sidebarCollapsed ? 0 : SIDEBAR_WIDTH })
      .catch(() => {});
  }, [sidebarCollapsed]);

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'b') {
        setSidebarCollapsed((v) => !v);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Ensure modal overlays appear above the BrowserView by temporarily detaching it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (showImport) await window.comet.viewSetVisible(false);
        else await window.comet.viewSetVisible(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [showImport]);

  // DevTools shortcut: Ctrl+Shift+I opens docked devtools
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'i') {
        e.preventDefault();
        window.comet.openDevTools().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Render assistant message with clickable [n] citations
  const renderAssistantHtml = (content: string) => {
    const escape = (s: string) => (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const linkified = escape(content).replace(/\[(\d{1,3})\]/g, (_m, g1) => `<a href="#" data-cite="${g1}" class="text-emerald-700 underline">[${g1}]</a>`);
    return linkified.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
  };

  const onNavigate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await window.comet.navigate(omnibox);
      const u = await window.comet.getUrl();
      setCurrentUrl(u || '');
    } finally {
      setBusy(false);
    }
  };

  // Web search results are shown by navigating to top result via omnibox.

  const onChangeProvider = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value as any;
    setBusy(true);
    try {
      const applied = await window.comet.setSearchProvider(p);
      setProvider(applied);
    } finally {
      setBusy(false);
    }
  };

  const runLocalSearch = async () => {
    setBusy(true);
    try {
      const res = await window.comet.searchLocal(query);
      setLocalResults(res || []);
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    setBusy(true);
    try {
      const messages = [
        { role: 'user' as const, content: prompt },
      ];
      const reply = await window.comet.aiChat(messages, { includePage });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } finally {
      setBusy(false);
    }
  };

  const submitChat = async () => {
    const q = prompt.trim();
    if (!q) return;
    // Append user message and clear input
    setChatMessages((prev) => [...prev, { role: 'user', content: q }]);
    setPrompt('');
    await runAi();
  };

  const toggleBookmark = async () => {
    const url = await window.comet.getUrl();
    if (!url) return;
    await window.comet.bookmarks.toggle(url);
  };

  const toggleSidebar = async () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
  };

  const Item = useMemo(() => (
    function Item({ title, sub, href }: { title: string; sub?: string; href?: string }) {
      return (
        <div className="px-3 py-2 rounded border border-gray-200 hover:bg-gray-50">
          <div className="font-medium text-sm truncate">{title}</div>
          {sub ? <div className="text-xs text-gray-600 truncate">{sub}</div> : null}
          {href ? (
            <button
              className="text-xs text-blue-600 hover:underline mt-1"
              onClick={() => setOmnibox(href)}
              title="Copy to omnibox"
            >
              Use URL
            </button>
          ) : null}
        </div>
      );
    }
  ), []);

  return (
    <div className="h-screen w-screen">
      {/* Tabs strip (topmost) */}
      <div className="fixed top-0 left-0 right-0 h-8 bg-white border-b border-gray-200 flex items-center gap-1 px-2 overflow-auto">
        {tabs.map((t) => (
          <div key={t.id} className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs whitespace-nowrap ${t.active ? 'bg-gray-100 border-gray-400' : 'border-gray-200'}`}>
            <button className="truncate max-w-[140px]" title={t.title || t.url} onClick={() => window.comet.tabs.activate(t.id)}>
              {t.title || t.url || 'New Tab'}
            </button>
            <button className="text-gray-500 hover:text-black" title="Close tab" onClick={() => window.comet.tabs.close(t.id)}>×</button>
          </div>
        ))}
        <button className="px-2 py-0.5 border rounded text-xs" title="New Tab" onClick={() => window.comet.tabs.create()}>＋</button>
      </div>

      {/* Toolbar below tabs strip */}
      <div className="fixed top-8 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center gap-2 px-3 overflow-hidden">
        {/* Nav buttons moved to the left of the omnibox */}
        <div className="flex items-center gap-2">
          <button onClick={() => window.comet.goBack()} className="px-2 py-1 border rounded" title="Back">◀</button>
          <button onClick={() => window.comet.goForward()} className="px-2 py-1 border rounded" title="Forward">▶</button>
        </div>
        <form onSubmit={onNavigate} className="flex-1 flex gap-2 items-center min-w-0">
          <input
            value={omnibox}
            onChange={(e) => setOmnibox(e.target.value)}
            className="flex-1 px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring focus:ring-blue-200"
            placeholder="Search or enter address"
          />
          <label className="text-xs text-gray-600">via</label>
          <select value={provider} onChange={onChangeProvider} className="text-xs border rounded px-2 py-2">
            <option value="searxng">searxng</option>
            <option value="brave">brave</option>
            <option value="google">google</option>
            <option value="bing">bing</option>
            <option value="presearch">presearch</option>
            <option value="auto">auto</option>
          </select>
          <button disabled={busy} className="px-3 py-2 bg-blue-600 text-white rounded">Go</button>
        </form>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="px-2 py-1 border rounded" title="Import browser data">
            Import
          </button>
          <button onClick={toggleSidebar} className="px-2 py-1 border rounded" title="Toggle sidebar (Ctrl+B)">
            {sidebarCollapsed ? 'Show AI' : 'Hide AI'}
          </button>
          <button onClick={() => window.comet.reload()} className="px-2 py-1 border rounded">⟳</button>
          <button onClick={() => window.comet.toggleReader()} className="px-2 py-1 border rounded">Read</button>
          <button onClick={toggleBookmark} className="px-2 py-1 border rounded">☆</button>
        </div>
      </div>

      {/* Right sidebar (clickable area not covered by BrowserView) */}
      {!sidebarCollapsed && (
        <div className="fixed top-24 right-0 bottom-8" style={{ width: SIDEBAR_WIDTH }}>
          <div className="relative h-full w-full border-l bg-white">
            {/* Scrollable content area with bottom padding for input bar */}
            <div className="absolute inset-0 overflow-auto p-4 pb-28 space-y-3">
              <div className="text-sm font-semibold">Local Search + AI</div>

              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border border-gray-300"
                  placeholder="Search local history and documents"
                />
                <button onClick={runLocalSearch} disabled={busy} className="px-3 py-2 bg-gray-700 text-white rounded">Local</button>
              </div>

              <div className="grid gap-2">
                {localResults.length ? (
                  <div className="grid gap-2">
                    {localResults.map((r, i) => (
                      <Item
                        key={i}
                        title={r.type === 'history' ? r.title || r.url : r.title || r.path}
                        sub={r.type === 'history' ? r.url : r.path}
                        href={r.type === 'history' ? r.url : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">No local results yet.</div>
                )}

                {/* Side panel mode switch */}
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1"><input type="radio" checked={sideMode==='chat'} onChange={() => setSideMode('chat')} /> Chat</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={sideMode==='agent'} onChange={() => setSideMode('agent')} /> Agent</label>
                </div>

                {/* Chat transcript */}
                {chatMessages.length ? (
                  <div className="grid gap-2">
                    {chatMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`text-sm p-3 rounded border ${m.role === 'assistant' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}
                        {...(m.role === 'assistant' ? { dangerouslySetInnerHTML: { __html: renderAssistantHtml(m.content) } } : {})}
                        onClick={async (e) => {
                          const t = e.target as HTMLElement | null;
                          const cite = t && t.getAttribute && t.getAttribute('data-cite');
                          if (cite) {
                            e.preventDefault();
                            const n = parseInt(cite, 10);
                            if (Number.isFinite(n)) {
                              try {
                                const ctx = await window.comet.getSearchContext();
                                const targetUrl = ctx && Array.isArray(ctx.results) ? ctx.results[n - 1]?.url : undefined;
                                if (targetUrl) {
                                  await window.comet.navigate(targetUrl);
                                } else {
                                  await window.comet.scrollToCitation(n);
                                }
                              } catch {
                                try { await window.comet.scrollToCitation(n); } catch {}
                              }
                            }
                          }
                        }}
                      >
                        {m.role === 'user' ? <div>{m.content}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Removed response mode dropdown to simplify UI */}
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); } }}
                  className="flex-1 px-3 py-2 rounded border border-gray-300"
                  placeholder={sideMode === 'agent' ? 'Ask the Agent' : 'Ask the AI assistant'}
                />
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={includePage} onChange={(e) => setIncludePage(e.target.checked)} /> include page
                </label>
                <button onClick={submitChat} disabled={busy} className="px-3 py-2 bg-emerald-600 text-white rounded">Ask</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-white border-t border-gray-200 px-3 flex items-center text-xs text-gray-600 truncate">
        <span className="truncate">{currentUrl}</span>
      </div>

      {/* Import Wizard */}
      <ImportWizard open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
