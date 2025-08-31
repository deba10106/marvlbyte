import React, { useEffect, useMemo, useState } from 'react';
import { ImportWizard } from './components/ImportWizard';
import { ThemeSelector } from './components/theme-selector';
import { useTheme } from './components/theme-provider';
import { Button } from './components/ui/button';
import { ToolPlayground } from './components/ToolPlayground';
import { 
  Moon, 
  Sun, 
  ArrowLeft, 
  ArrowRight, 
  RefreshCw, 
  Import, 
  PanelRightClose, 
  PanelRightOpen, 
  BookOpen,
  Settings,
  History,
  User,
  Download,
  Key,
  Cookie,
  Database,
  Sparkles
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';

export function App() {
  const { theme } = useTheme();
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
        <div className="px-3 py-2 rounded border border-border bg-card text-card-foreground hover:bg-accent/10">
          <div className="font-medium text-sm truncate">{title}</div>
          {sub ? <div className="text-xs text-muted-foreground truncate">{sub}</div> : null}
          {href ? (
            <button
              className="text-xs text-primary hover:underline mt-1"
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

  // Force dark mode  // Update main window background color when theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    const backgroundColor = getComputedStyle(root).getPropertyValue('--background').trim();
    if (backgroundColor && window.comet?.ipcRenderer) {
      window.comet.ipcRenderer.send('set-background-color', backgroundColor, theme);
    }
  }, [theme]);

  // Tool Playground is now opened in a new browser tab instead of an overlay page

  // Check if current URL is a special URL that should render a different component
  const isToolPlaygroundUrl = currentUrl.startsWith('about:tool-playground');
  
  // Ensure the BrowserView does not intercept clicks when rendering special content (Tool Playground)
  useEffect(() => {
    (async () => {
      try {
        if (isToolPlaygroundUrl) {
          await window.comet.viewSetVisible(false);
        } else {
          await window.comet.viewSetVisible(true);
        }
      } catch {
        // ignore
      }
    })();
  }, [isToolPlaygroundUrl]);
  
  // Render special page content instead of browser view when matching special URLs
  const renderSpecialContent = () => {
    if (isToolPlaygroundUrl) {
      return (
        <div className="h-screen w-screen bg-background text-foreground">
          <div className="container mx-auto pt-24 px-4 pb-16">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">Browser Control Playground</h1>
                <p className="text-muted-foreground">Test browser automation APIs and build agent workflows</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.comet.openDevTools()}>
                  Open DevTools
                </Button>
              </div>
            </div>
            <ToolPlayground />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground">
      {/* Tabs strip (topmost) */}
      <div className="fixed top-0 left-0 right-0 h-8 bg-background border-b border-border flex items-center gap-1 px-2 overflow-auto">
        {tabs.map((t) => (
          <div key={t.id} className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs whitespace-nowrap ${t.active ? 'bg-accent border-accent-foreground' : 'border-border'}`}>
            <button className="truncate max-w-[140px]" title={t.title || t.url} onClick={() => window.comet.tabs.activate(t.id)}>
              {t.title || t.url || 'New Tab'}
            </button>
            <button className="text-muted-foreground hover:text-foreground" title="Close tab" onClick={() => window.comet.tabs.close(t.id)}>×</button>
          </div>
        ))}
        <button className="px-2 py-0.5 border rounded text-xs text-foreground bg-background border-border" title="New Tab" onClick={() => window.comet.tabs.create()}>＋</button>
      </div>

      {/* Toolbar below tabs strip */}
      <div className="fixed top-8 left-0 right-0 h-16 bg-background border-b border-border flex items-center gap-2 px-3 overflow-hidden">
        {/* Nav buttons moved to the left of the omnibox */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.comet.goBack()} title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.comet.goForward()} title="Forward">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={onNavigate} className="flex-1 flex gap-2 items-center min-w-0">
          <input
            value={omnibox}
            onChange={(e) => setOmnibox(e.target.value)}
            className="flex-1 px-3 py-2 rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder="Search or enter address"
          />
          <label className="text-xs text-foreground">via</label>
          <select value={provider} onChange={onChangeProvider} className="text-xs border rounded px-2 py-2 bg-background border-input">
            <option value="searxng">searxng</option>
            <option value="brave">brave</option>
            <option value="google">google</option>
            <option value="bing">bing</option>
            <option value="presearch">presearch</option>
            <option value="auto">auto</option>
          </select>
          <Button disabled={busy} variant="default" size="sm">Go</Button>
        </form>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} title="Import browser data">
            <Import className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={toggleSidebar} title="Toggle sidebar (Ctrl+B)">
            {sidebarCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.comet.reload()} title="Reload">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.comet.toggleReader()} title="Reader mode">
            <BookOpen className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Browser Settings</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => window.alert('History page not implemented')}>
                <History className="mr-2 h-4 w-4" />
                <span>History</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.alert('Profile page not implemented')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.alert('Downloads page not implemented')}>
                <Download className="mr-2 h-4 w-4" />
                <span>Downloads</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Security</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => window.alert('Passwords page not implemented')}>
                <Key className="mr-2 h-4 w-4" />
                <span>Passwords</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.alert('Cookies page not implemented')}>
                <Cookie className="mr-2 h-4 w-4" />
                <span>Cookies</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.alert('Sessions page not implemented')}>
                <Database className="mr-2 h-4 w-4" />
                <span>Sessions</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>AI Tools</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => window.comet.tabs.create('about:tool-playground')}>
                <Sparkles className="mr-2 h-4 w-4" />
                <span>AI Playground</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeSelector />
        </div>
      </div>

      {/* Special URL content */}
      {isToolPlaygroundUrl && renderSpecialContent()}
      
      {/* Hide browser view content when showing special URLs */}
      {!isToolPlaygroundUrl && (
        <>
          {/* Right sidebar (clickable area not covered by BrowserView) */}
          {!sidebarCollapsed && (
        <div className="fixed top-24 right-0 bottom-8" style={{ width: SIDEBAR_WIDTH }}>
          <div className="relative h-full w-full border-l bg-background">
            {/* Scrollable content area with bottom padding for input bar */}
            <div className="absolute inset-0 overflow-auto p-4 pb-28 space-y-3">
              <div className="text-sm font-semibold">Local Search + AI</div>

              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Search local history and documents"
                />
                <Button onClick={runLocalSearch} disabled={busy} variant="secondary" size="sm">Local</Button>
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
                  <div className="text-xs text-muted-foreground">No local results yet.</div>
                )}

                {/* Side panel mode switch */}
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <label className="flex items-center gap-1"><input type="radio" checked={sideMode==='chat'} onChange={() => setSideMode('chat')} /> Chat</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={sideMode==='agent'} onChange={() => setSideMode('agent')} /> Agent</label>
                </div>

                {/* Side content: Chat vs Agent */}
                {sideMode === 'chat' ? (
                  <>
                  {/* Chat transcript */}
                  {chatMessages.length ? (
                    <div className="grid gap-2">
                      {chatMessages.map((m, i) => (
                        <div
                          key={i}
                          className={`text-sm p-3 rounded border ${m.role === 'assistant' ? 'bg-accent/20 border-accent' : 'bg-card border-border'}`}
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

                  {/* Chat input */}
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); } }}
                    className="flex-1 px-3 py-2 rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    placeholder={'Ask the AI assistant'}
                  />
                  <label className="text-xs text-foreground flex items-center gap-1">
                    <input type="checkbox" checked={includePage} onChange={(e) => setIncludePage(e.target.checked)} /> include page
                  </label>
                  <Button onClick={submitChat} disabled={busy} variant="default">Ask</Button>
                </>
                ) : (
                  <>
                    {/* Agent workflow results/logs and inputs */}
                    <div className="grid gap-3">
                      <div className="p-3 rounded border border-border bg-card">
                        <h3 className="text-sm font-medium mb-2">Agent Workflow</h3>
                        <p className="text-xs text-muted-foreground mb-3">Interact with agent workflows. Tool Playground is now available in Settings → AI Playground.</p>
                        
                        {/* Agent logs will appear here */}
                        <div className="bg-muted/30 rounded p-2 mb-3 text-xs h-32 overflow-auto">
                          <div className="text-muted-foreground italic">Agent logs will appear here...</div>
                        </div>
                        
                        {/* Agent input */}
                        <div className="space-y-3">
                          <textarea 
                            className="w-full px-3 py-2 rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm min-h-[80px]"
                            placeholder="Enter instructions for the agent..."
                          />
                          
                          {/* File upload */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 border-dashed border-border bg-muted/20 cursor-pointer hover:bg-muted/30 w-full">
                                <input type="file" className="hidden" />
                                <span>Upload File</span>
                              </label>
                            </div>
                            <Button variant="default" size="sm">Run Agent</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-background border-t border-border px-3 flex items-center text-xs text-muted-foreground truncate">
        <span className="truncate">{currentUrl}</span>
      </div>

      {/* Import Wizard */}
      <ImportWizard open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
