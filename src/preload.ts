import { contextBridge, ipcRenderer } from 'electron';

export type BraveSearchResult = { title: string; description: string; url: string };
export type BraveSearchResponse = { results: BraveSearchResult[]; query: string; summary?: string; suggestions?: string[] };
export type AIChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type LocalSearchResult =
  | { type: 'document'; path: string; title: string; snippet?: string; indexedAt: number; size?: number; mime?: string }
  | { type: 'history'; url: string; title: string };
export type SearchProvider = 'auto' | 'brave' | 'searxng' | 'google' | 'bing' | 'presearch';

export interface CometApi {
  navigate: (input: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;
  getUrl: () => Promise<string | undefined>;
  onUrlChanged: (cb: (url: string) => void) => () => void;
  getSearchContext: () => Promise<{ query: string; results: BraveSearchResult[] } | undefined>;
  scrollToCitation: (n: number) => Promise<void>;
  setLayout: (layout: { top: number; rightSidebarWidth: number }) => Promise<void>;
  toggleReader: () => Promise<void>;
  viewSetVisible: (visible: boolean) => Promise<void>;
  openDevTools: () => Promise<void>;
  searchWeb: (query: string) => Promise<BraveSearchResponse>;
  searchBrave: (query: string) => Promise<BraveSearchResponse>;
  searchLocal: (query: string) => Promise<LocalSearchResult[]>;
  aiChat: (messages: AIChatMessage[], options?: { includePage?: boolean }) => Promise<string>;
  getSearchProvider: () => Promise<SearchProvider>;
  setSearchProvider: (p: SearchProvider) => Promise<SearchProvider>;
  bookmarks: {
    add: (title: string, url: string, tags?: string[]) => Promise<{ id: number; title: string; url: string; createdAt: number; tags?: string[] } | undefined>;
    list: () => Promise<Array<{ id: number; title: string; url: string; createdAt: number; tags?: string[] }>>;
    remove: (id: number) => Promise<void>;
    toggle: (url: string) => Promise<{ toggled: 'added' | 'removed' }>;
  };
  downloads: {
    onStarted: (cb: (e: { id: string; filename: string; mime: string; totalBytes: number; savePath: string }) => void) => () => void;
    onUpdated: (cb: (e: { id: string; state: string; receivedBytes: number; totalBytes: number; paused: boolean; canResume: boolean; savePath: string }) => void) => () => void;
    onDone: (cb: (e: { id: string; state: string; savePath: string }) => void) => () => void;
    list: () => Promise<Array<{ id: string; filename: string; receivedBytes: number; totalBytes: number; paused: boolean; canResume: boolean; state: string; savePath: string }>>;
    pause: (id: string) => Promise<void>;
    resume: (id: string) => Promise<void>;
    cancel: (id: string) => Promise<void>;
    showInFolder: (id: string) => Promise<void>;
    openFile: (id: string) => Promise<void>;
  };
  findInPage: {
    start: (text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) => Promise<void>;
    stop: (action?: 'clearSelection' | 'keepSelection' | 'activateSelection') => Promise<void>;
    onResult: (cb: (r: any) => void) => () => void;
  };
  zoom: {
    get: () => Promise<number>;
    set: (level: number) => Promise<number | undefined>;
    reset: () => Promise<number | undefined>;
    in: () => Promise<number | undefined>;
    out: () => Promise<number | undefined>;
  };
  permissions: {
    onRequested: (cb: (e: { permission: string }) => void) => () => void;
  };
  print: () => Promise<void>;
  printToPDF: () => Promise<string | undefined>;
  privacy: {
    clearBrowsingData: (opts?: { cache?: boolean; cookies?: boolean; storage?: boolean }) => Promise<boolean>;
  };
  history: {
    list: (opts?: { limit?: number; offset?: number; prefix?: string }) => Promise<Array<{ id: number; url: string; title: string; visitAt: number; visitCount: number }>>;
    suggest: (prefix: string) => Promise<Array<{ url: string; title: string; score?: number }>>;
  };
  import: {
    detectProfiles: () => Promise<Array<{ id: string; browser: string; name: string; paths: Record<string, string | undefined> }>>;
    preview: (profileId: string) => Promise<{ profileId: string; browser: string; counts: Record<string, number | undefined>; notes?: string[] }>;
    run: (profileId: string, opts?: { history?: boolean; bookmarks?: boolean; cookies?: boolean; passwords?: boolean; sessions?: boolean; limit?: number }) => Promise<{ profileId: string; browser: string; imported: Record<string, number>; errors?: string[] }>;
  };
  onboarding: {
    get: () => Promise<{ showImportOnFirstRun: boolean; importCompleted?: boolean }>;
    set: (patch: Partial<{ showImportOnFirstRun: boolean; importCompleted?: boolean }>) => Promise<{ showImportOnFirstRun: boolean; importCompleted?: boolean }>;
  };
  tabs: {
    create: (url?: string) => Promise<{ id: string } | undefined>;
    list: () => Promise<Array<{ id: string; title: string; url: string; active: boolean }>>;
    activate: (id: string) => Promise<Array<{ id: string; title: string; url: string; active: boolean }>>;
    close: (id: string) => Promise<Array<{ id: string; title: string; url: string; active: boolean }>>;
    onUpdated: (cb: (tabs: Array<{ id: string; title: string; url: string; active: boolean }>) => void) => () => void;
    onActiveChanged: (cb: (e: { id: string; url: string; title: string }) => void) => () => void;
  };
}

const api: CometApi = {
  navigate: (input: string) => ipcRenderer.invoke('omnibox:navigate', input),
  goBack: () => ipcRenderer.invoke('nav:back'),
  goForward: () => ipcRenderer.invoke('nav:forward'),
  reload: () => ipcRenderer.invoke('nav:reload'),
  getUrl: () => ipcRenderer.invoke('tab:get-url'),
  onUrlChanged: (cb) => {
    const handler = (_: unknown, url: string) => {
      try { cb(url); } catch {}
    };
    ipcRenderer.on('tab:url-changed', handler);
    return () => ipcRenderer.removeListener('tab:url-changed', handler);
  },
  print: () => ipcRenderer.invoke('tab:print'),
  printToPDF: () => ipcRenderer.invoke('tab:print-to-pdf'),
  privacy: {
    clearBrowsingData: (opts) => ipcRenderer.invoke('privacy:clear-browsing-data', opts || {}),
  },
  downloads: {
    onStarted: (cb) => {
      const handler = (_: unknown, payload: any) => { try { cb(payload); } catch {} };
      ipcRenderer.on('downloads:started', handler);
      return () => ipcRenderer.removeListener('downloads:started', handler);
    },
    onUpdated: (cb) => {
      const handler = (_: unknown, payload: any) => { try { cb(payload); } catch {} };
      ipcRenderer.on('downloads:updated', handler);
      return () => ipcRenderer.removeListener('downloads:updated', handler);
    },
    onDone: (cb) => {
      const handler = (_: unknown, payload: any) => { try { cb(payload); } catch {} };
      ipcRenderer.on('downloads:done', handler);
      return () => ipcRenderer.removeListener('downloads:done', handler);
    },
    list: () => ipcRenderer.invoke('downloads:list'),
    pause: (id: string) => ipcRenderer.invoke('downloads:pause', id),
    resume: (id: string) => ipcRenderer.invoke('downloads:resume', id),
    cancel: (id: string) => ipcRenderer.invoke('downloads:cancel', id),
    showInFolder: (id: string) => ipcRenderer.invoke('downloads:show-in-folder', id),
    openFile: (id: string) => ipcRenderer.invoke('downloads:open-file', id),
  },
  findInPage: {
    start: (text, options) => ipcRenderer.invoke('find:start', text, options || {}),
    stop: (action) => ipcRenderer.invoke('find:stop', action || 'clearSelection'),
    onResult: (cb) => {
      const handler = (_: unknown, result: any) => { try { cb(result); } catch {} };
      ipcRenderer.on('find:result', handler);
      return () => ipcRenderer.removeListener('find:result', handler);
    },
  },
  zoom: {
    get: () => ipcRenderer.invoke('zoom:get'),
    set: (level: number) => ipcRenderer.invoke('zoom:set', level),
    reset: () => ipcRenderer.invoke('zoom:reset'),
    in: () => ipcRenderer.invoke('zoom:in'),
    out: () => ipcRenderer.invoke('zoom:out'),
  },
  permissions: {
    onRequested: (cb) => {
      const handler = (_: unknown, payload: any) => { try { cb(payload); } catch {} };
      ipcRenderer.on('permissions:requested', handler);
      return () => ipcRenderer.removeListener('permissions:requested', handler);
    },
  },
  getSearchContext: () => ipcRenderer.invoke('tab:get-search-context'),
  scrollToCitation: (n: number) => ipcRenderer.invoke('tab:scroll-to-citation', n),
  setLayout: (layout: { top: number; rightSidebarWidth: number }) => ipcRenderer.invoke('layout:set', layout),
  toggleReader: () => ipcRenderer.invoke('reader:toggle'),
  viewSetVisible: (visible: boolean) => ipcRenderer.invoke('view:set-visible', !!visible),
  openDevTools: () => ipcRenderer.invoke('devtools:open'),
  searchWeb: (query: string) => ipcRenderer.invoke('search:web', query),
  // alias for backward compatibility
  searchBrave: (query: string) => ipcRenderer.invoke('search:web', query),
  searchLocal: (query: string) => ipcRenderer.invoke('search:local', query),
  aiChat: (messages: AIChatMessage[], options?: { includePage?: boolean }) => ipcRenderer.invoke('ai:chat', { messages, options }),
  getSearchProvider: () => ipcRenderer.invoke('search:get-provider'),
  setSearchProvider: (p) => ipcRenderer.invoke('search:set-provider', p),
  bookmarks: {
    add: (title, url, tags) => ipcRenderer.invoke('bookmarks:add', { title, url, tags }),
    list: () => ipcRenderer.invoke('bookmarks:list'),
    remove: (id) => ipcRenderer.invoke('bookmarks:remove', id),
    toggle: (url) => ipcRenderer.invoke('bookmarks:toggle', url),
  },
  history: {
    list: (opts) => ipcRenderer.invoke('history:list', opts || {}),
    suggest: (prefix) => ipcRenderer.invoke('history:suggest', prefix),
  },
  import: {
    detectProfiles: () => ipcRenderer.invoke('import:detect-profiles'),
    preview: (profileId: string) => ipcRenderer.invoke('import:preview', profileId),
    run: (profileId: string, opts?: any) => ipcRenderer.invoke('import:run', profileId, opts || {}),
  },
  onboarding: {
    get: () => ipcRenderer.invoke('onboarding:get'),
    set: (patch: any) => ipcRenderer.invoke('onboarding:set', patch || {}),
  },
  tabs: {
    create: (url?: string) => ipcRenderer.invoke('tabs:create', url),
    list: () => ipcRenderer.invoke('tabs:list'),
    activate: (id: string) => ipcRenderer.invoke('tabs:activate', id),
    close: (id: string) => ipcRenderer.invoke('tabs:close', id),
    onUpdated: (cb) => {
      const handler = (_: unknown, payload: any) => { try { cb(payload); } catch {} };
      ipcRenderer.on('tabs:updated', handler);
      return () => ipcRenderer.removeListener('tabs:updated', handler);
    },
    onActiveChanged: (cb) => {
      const handler = (_: unknown, payload: any) => { try { cb(payload); } catch {} };
      ipcRenderer.on('tabs:active-changed', handler);
      return () => ipcRenderer.removeListener('tabs:active-changed', handler);
    },
  },
};

contextBridge.exposeInMainWorld('comet', api);

declare global {
  interface Window {
    comet: CometApi;
  }
}
