import { contextBridge, ipcRenderer } from 'electron';

export type BraveSearchResult = { title: string; description: string; url: string };
export type BraveSearchResponse = { results: BraveSearchResult[]; query: string; summary?: string; suggestions?: string[] };
export type AIChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type LocalSearchResult =
  | { type: 'document'; path: string; title: string; snippet?: string; indexedAt: number; size?: number; mime?: string }
  | { type: 'history'; url: string; title: string };
export type SearchProvider = 'auto' | 'brave' | 'searxng' | 'google' | 'bing' | 'presearch';

// Tool Playground shared types (duplicated locally for preload isolation)
export type ToolEngine = 'http' | 'ai' | 'dom' | 'mcp' | 'render' | 'storage';
export type ApprovalMode = 'auto' | 'manual' | 'disabled';
export type ToolSchema = { type?: 'object'; required?: string[]; properties?: Record<string, any> };
export type RedactionConfig = { inputPaths?: string[]; outputPaths?: string[] };
export type HttpToolConfig = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  allowedDomains: string[];
  timeoutMs?: number;
};
export type AiToolConfig = { prompt: string; system?: string; provider?: string };
export type DomToolConfig = { script: string; allowedDomains: string[]; timeoutMs?: number; readOnly?: boolean };
export type ToolDefinition = {
  id?: number;
  name: string;
  title?: string;
  description?: string;
  engine: ToolEngine;
  schema?: ToolSchema;
  config: HttpToolConfig | AiToolConfig | DomToolConfig | Record<string, any>;
  approval?: ApprovalMode;
  rateLimit?: number;
  redaction?: RedactionConfig;
  createdAt?: number;
  updatedAt?: number;
  // Internal form state fields (not persisted)
  _rawSchema?: string;
  _rawConfig?: string;
  _rawRedaction?: string;
};
export type ToolExecutionResult =
  | { ok: true; output: any; auditId: number }
  | { ok: false; error: string; auditId?: number }
  | { pendingApproval: true; auditId: number };

export interface CometApi {
  // Direct access to ipcRenderer for theme-related messages
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void;
  };
  navigate: (input: string, tabId?: string) => Promise<void>;
  goBack: (tabId?: string) => Promise<void>;
  goForward: (tabId?: string) => Promise<void>;
  reload: (tabId?: string) => Promise<void>;
  getUrl: (tabId?: string) => Promise<string | undefined>;
  onUrlChanged: (cb: (url: string) => void) => () => void;
  getSearchContext: () => Promise<{ query: string; results: BraveSearchResult[] } | undefined>;
  scrollToCitation: (n: number) => Promise<void>;
  setLayout: (layout: { top: number; rightSidebarWidth: number }) => Promise<void>;
  toggleReader: () => Promise<void>;
  viewSetVisible: (visible: boolean) => Promise<void>;
  openDevTools: () => Promise<void>;
  inspectElement: (tabId: string) => Promise<void>;
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
  
  // Browser control APIs
  refresh: (tabId?: string) => Promise<void>;
  executeScript: (script: string, tabId?: string) => Promise<any>;
  getCurrentURL: (tabId?: string) => Promise<string>;
}

const api: CometApi = {
  // Expose limited ipcRenderer for theme-related messages
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  },
  navigate: (input: string, tabId?: string) => ipcRenderer.invoke('omnibox:navigate', { url: input, tabId }),
  goBack: (tabId?: string) => ipcRenderer.invoke('nav:back', { tabId }),
  goForward: (tabId?: string) => ipcRenderer.invoke('nav:forward', { tabId }),
  reload: (tabId?: string) => ipcRenderer.invoke('nav:reload', { tabId }),
  getUrl: (tabId?: string) => ipcRenderer.invoke('tab:get-url', { tabId }),
  onUrlChanged: (cb) => {
    const handler = (_: unknown, url: string) => {
      try { cb(url); } catch {}
    };
    ipcRenderer.on('tab:url-changed', handler);
    return () => ipcRenderer.removeListener('tab:url-changed', handler);
  },
  print: (tabId?: string) => ipcRenderer.invoke('tab:print', { tabId }),
  printToPDF: (tabId?: string) => ipcRenderer.invoke('tab:print-to-pdf', { tabId }),
  refresh: (tabId?: string) => ipcRenderer.invoke('tab:reload', { tabId }),
  executeScript: (script: string, tabId?: string) => ipcRenderer.invoke('tab:execute-script', { script, tabId }),
  getCurrentURL: (tabId?: string) => ipcRenderer.invoke('tab:get-url', { tabId }),
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
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  inspectElement: (tabId: string) => ipcRenderer.invoke('inspect-element', tabId),
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

// Expose DOM and Semantic utilities (aligned with main IPC handlers)
const domUtils = {
  extractElement: (selector: string, attributes?: string[], tabId?: string) =>
    ipcRenderer.invoke('dom:extract-element', { tabId, selector, options: { attributes } }),

  extractTable: (selector: string, options?: any, tabId?: string) =>
    ipcRenderer.invoke('dom:extract-table', { tabId, selector, options }),

  extractImages: (selector?: string, options?: any, tabId?: string) =>
    ipcRenderer.invoke('dom:extract-images', { tabId, selector, options }),

  extractLinks: (selector?: string, options?: any, tabId?: string) =>
    ipcRenderer.invoke('dom:extract-links', { tabId, selector, options }),

  extractMeta: (options?: any, tabId?: string) =>
    ipcRenderer.invoke('dom:extract-meta', { tabId, options })
};

const semanticUtils = {
  extract: (contentOrOptions: any, optionsOrTabId?: any, maybeTabId?: string) => {
    let content: string | undefined;
    let options: any = {};
    let tabId: string | undefined;

    if (typeof contentOrOptions === 'string' || contentOrOptions === undefined) {
      content = contentOrOptions as string | undefined;
      options = optionsOrTabId || {};
      tabId = maybeTabId;
    } else {
      options = contentOrOptions || {};
      tabId = optionsOrTabId;
    }

    const payloadOptions = content !== undefined ? { ...options, content } : options;
    return ipcRenderer.invoke('semantic:extract', { tabId, options: payloadOptions });
  },

  summarize: (options?: any, tabId?: string) =>
    ipcRenderer.invoke('semantic:summarize', { tabId, options }),

  recognizeEntities: (options?: any, tabId?: string) =>
    ipcRenderer.invoke('semantic:recognize-entities', { tabId, options }),

  classify: (options: any, tabId?: string) =>
    ipcRenderer.invoke('semantic:classify', { tabId, options }),

  extractSemanticTable: (options: any, tabId?: string) =>
    ipcRenderer.invoke('semantic:extract-table', { tabId, options })
};

// Expose both the main API and the utilities
contextBridge.exposeInMainWorld('comet', {
  ...api,
  dom: domUtils,
  semantic: semanticUtils
});

// Backward-compatible alias expected by some renderer hooks
contextBridge.exposeInMainWorld('electron', {
  dom: domUtils,
  semantic: semanticUtils
});

declare global {
  interface Window {
    comet: CometApi;
  }
}
