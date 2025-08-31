import { app, BrowserWindow, BrowserView, ipcMain, session, shell, Menu, nativeTheme } from 'electron';
import type { IpcMainInvokeEvent, Event as ElectronEvent } from 'electron';
import { EventEmitter } from 'events';
import { DOMUtils } from './dom-utils';
import { SemanticUtils } from './semantic-utils';
import path from 'path';

import { loadConfig, ensureConfigDir, AppConfig, saveConfig } from './services/config';
import { getDb } from './services/db';
import { BookmarksService } from './services/bookmarks';
import { HistoryService } from './services/history';
import { AiService } from './services/ai';
import { SearchService } from './services/search';
import { IndexerService } from './services/indexer';
import { ImportService } from './services/import';
import type { ImportRunOptions } from './services/import';

// Increase the default max listeners to prevent MaxListenersExceededWarning
EventEmitter.defaultMaxListeners = 30; // Increased from 20 to handle more listeners

// Configure app for media handling to fix ffmpeg errors
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder');

// Store current theme for immediate application to new tabs
let currentTheme = 'dark'; // Default theme

// Some sites are sensitive to global CSS overrides. Bypass theming there.
function shouldBypassTheming(url: string): boolean {
  try {
    const u = new URL(url);
    const h = (u.hostname || '').toLowerCase();
    const bypassHosts = [
      'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
      'studio.youtube.com',
    ];
    return bypassHosts.some((b) => h === b || h.endsWith('.' + b));
  } catch {
    return false;
  }
}

// Helper function to apply theme CSS to webContents
function applyThemeToWebContents(webContents: Electron.WebContents, themeName?: string) {
  if (!webContents || webContents.isDestroyed()) return;
  // Avoid injecting global overrides on sensitive sites (e.g., YouTube)
  try {
    const url = webContents.getURL?.() || '';
    if (url && shouldBypassTheming(url)) return;
  } catch {}
  
  // Handle each theme type separately
  if (themeName === 'light') {
    const lightCss = `
      html, body, div, main, article, section, header, footer, nav, aside {
        background-color: #ffffff !important;
        color: #000000 !important;
      }
      * {
        color-scheme: light !important;
      }
      a, a:visited, a:hover, a:active {
        color: #0066cc !important;
      }
      p, span, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, label, legend {
        color: #000000 !important;
      }
      input, textarea, select, button {
        background-color: #f8f8f8 !important;
        color: #000000 !important;
        border-color: #d1d1d1 !important;
      }
      /* Force override for common frameworks */
      .bg-dark, [class*='bg-dark'], [class*='bg-black'] {
        background-color: #ffffff !important;
      }
      .text-white, [class*='text-light'] {
        color: #000000 !important;
      }
    `;
    webContents.insertCSS(lightCss).catch(() => {});
    return;
  }
  
  // Nord theme specific styling
  if (themeName === 'nord') {
    const nordCss = `
      html, body, div, main, article, section, header, footer, nav, aside {
        background-color: #2e3440 !important;
        color: #d8dee9 !important;
      }
      * {
        color-scheme: dark !important;
      }
      a, a:visited, a:hover, a:active {
        color: #88c0d0 !important;
      }
      p, span, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, label, legend {
        color: #e5e9f0 !important;
      }
      input, textarea, select, button {
        background-color: #3b4252 !important;
        color: #e5e9f0 !important;
        border-color: #4c566a !important;
      }
      img, video {
        filter: brightness(.9) contrast(1.1);
      }
      /* Force override for common frameworks */
      .bg-white, [class*='bg-light'], [class*='bg-default'], [class*='bg-body'] {
        background-color: #2e3440 !important;
      }
      .text-dark, [class*='text-black'], [class*='text-default'] {
        color: #e5e9f0 !important;
      }
    `;
    webContents.insertCSS(nordCss).catch(() => {});
    return;
  }
  
  // Cyberpunk theme specific styling
  if (themeName === 'cyberpunk') {
    const cyberpunkCss = `
      html, body, div, main, article, section, header, footer, nav, aside {
        background-color: #120458 !important;
        color: #f8f8f2 !important;
      }
      * {
        color-scheme: dark !important;
      }
      a, a:visited, a:hover, a:active {
        color: #f92aad !important;
      }
      p, span, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, label, legend {
        color: #f8f8f2 !important;
      }
      input, textarea, select, button {
        background-color: #2d1b69 !important;
        color: #f8f8f2 !important;
        border-color: #f92aad !important;
      }
      img, video {
        filter: brightness(.9) contrast(1.2) saturate(1.2);
      }
      /* Force override for common frameworks */
      .bg-white, [class*='bg-light'], [class*='bg-default'], [class*='bg-body'] {
        background-color: #120458 !important;
      }
      .text-dark, [class*='text-black'], [class*='text-default'] {
        color: #f8f8f2 !important;
      }
    `;
    webContents.insertCSS(cyberpunkCss).catch(() => {});
    return;
  }
  
  // Default dark theme
  const darkCss = `
    html, body, div, main, article, section, header, footer, nav, aside {
      background-color: #09090b !important;
      color: #ffffff !important;
    }
    * {
      color-scheme: dark !important;
    }
    a, a:visited, a:hover, a:active {
      color: #60a5fa !important;
    }
    p, span, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, label, legend {
      color: #ffffff !important;
    }
    input, textarea, select, button {
      background-color: #1f1f23 !important;
      color: #ffffff !important;
      border-color: #383838 !important;
    }
    img, video {
      filter: brightness(.8) contrast(1.2);
    }
    /* Force override for common frameworks */
    .bg-white, [class*='bg-light'], [class*='bg-default'], [class*='bg-body'] {
      background-color: #09090b !important;
    }
    .text-dark, [class*='text-black'], [class*='text-default'] {
      color: #ffffff !important;
    }
  `;
  
  webContents.insertCSS(darkCss).catch(() => {});
}
// MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY and MAIN_WINDOW_WEBPACK_ENTRY are provided by forge webpack plugin as globals

// In development use a separate userData to avoid locks with previous runs
if (process.env.NODE_ENV !== 'production') {
  try {
    const devPath = path.join(app.getPath('appData'), 'CometDev');
    app.setPath('userData', devPath);
  } catch {}
}

// Attach active BrowserView to the window if the renderer is ready
function attachViewIfReady() {
  try {
    if (!mainWindow) return;
    // Do not attach the BrowserView when the active tab is a special in-app page (about:*)
    const active = getActiveTab();
    if (active && typeof active.url === 'string' && active.url.startsWith('about:')) {
      try { mainWindow.setBrowserView(null as any); } catch {}
      return;
    }
    if (!view) return;
    const wc = mainWindow.webContents;
    if (!wc || wc.isDestroyed()) return;
    if (typeof wc.isLoadingMainFrame === 'function' && wc.isLoadingMainFrame()) return;
    mainWindow.setBrowserView(view);
    const { width, height } = mainWindow.getBounds();
    view.setBounds({ x: 0, y: Math.max(0, layoutTop), width: Math.max(0, width - Math.max(0, layoutRight)), height: Math.max(0, height - Math.max(0, layoutTop)) });
    view.setAutoResize({ width: true, height: true });
  } catch {}
}

async function ensureWebContentsReady(wc: Electron.WebContents, timeoutMs = 4000): Promise<void> {
  try {
    if (!wc || wc.isDestroyed()) return;
    const stillLoading = typeof wc.isLoadingMainFrame === 'function' && wc.isLoadingMainFrame();
    if (!stillLoading) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => { if (settled) return; settled = true; try { wc.removeListener('did-finish-load', onDone); wc.removeListener('dom-ready', onDone); } catch {} resolve(); };
      const onDone = () => done();
      try { wc.once('did-finish-load', onDone); wc.once('dom-ready', onDone); } catch {}
      setTimeout(done, timeoutMs);
    });
  } catch {}
}

let mainWindow: BrowserWindow | null = null;
let view: BrowserView | null = null; // active tab view
const tabs: Array<{ id: string; view: BrowserView; title: string; url: string }> = [];
let activeTabId: string | null = null;
let historyService: HistoryService | null = null;
// Current layout offsets provided by renderer (used for BrowserView bounds)
let layoutTop = 96; // tabs (32) + toolbar (64)
let layoutRight = 420; // default sidebar width; renderer will update

// Safe send to the renderer (main window) only
function sendRenderer(channel: string, payload: any) {
  try {
    const wc = mainWindow?.webContents;
    if (!wc || wc.isDestroyed()) return;
    // Avoid sending during main-frame reloads (common in dev HMR), which triggers
    // 'Render frame was disposed before WebFrameMain could be accessed'
    if (typeof wc.isLoadingMainFrame === 'function' && wc.isLoadingMainFrame()) return;
    wc.send(channel, payload);
  } catch {}
}

function getActiveTab() {
  if (!activeTabId) return null;
  return tabs.find((t) => t.id === activeTabId) || null;
}

function activateTab(id: string) {
  const t = tabs.find((x) => x.id === id);
  if (!t || !mainWindow) return;
  activeTabId = id;
  view = t.view;
  try {
    // Attach only when renderer main frame is ready to avoid UI disappearing
    const wc = mainWindow.webContents;
    const canAttach = wc && !wc.isDestroyed() && !(typeof wc.isLoadingMainFrame === 'function' && wc.isLoadingMainFrame());
    if (canAttach) {
      attachViewIfReady();
    }
  } catch {}
  sendRenderer('tabs:active-changed', { id, url: t.url, title: t.title });
  sendRenderer('tab:url-changed', t.url);
}

function createTab(initialUrl?: string) {
  // Handle special URLs
  let isSpecialUrl = false;
  if (initialUrl && initialUrl.startsWith('about:')) {
    isSpecialUrl = true;
    // For special URLs, we'll let the renderer handle them with special components
  }
  
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const v = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-view.js'),
      // Add media-specific settings
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  
  // Configure session for media handling
  try {
    const ses = v.webContents.session;
    
    // Configure content settings for media
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow media permissions by default
      if (permission === 'media') {
        callback(true);
        return;
      }
      callback(false);
    });
    
    // Configure content blocker to suppress ERR_BLOCKED_BY_CLIENT warnings
    ses.webRequest.onErrorOccurred((details) => {
      // Silently handle blocked requests
      if (details.error === 'ERR_BLOCKED_BY_CLIENT') {
        // This is handled by our preload script's console filter
        return;
      }
    });
  } catch (e) {
    console.log('Error configuring session:', e);
  }
  
  // Set background color separately as it's not part of the constructor options
  try {
    v.setBackgroundColor('#09090b'); // Default to dark theme background
  } catch {}
  // Hide native menu bar so our tabs strip can be visually on top
  try { mainWindow?.setMenuBarVisibility(false); } catch {}
  try { mainWindow?.setAutoHideMenuBar(true); } catch {}
  const t = { id, view: v, title: 'New Tab', url: '' };
  tabs.push(t);

  // Wire per-tab events
  v.webContents.on('page-title-updated', (_e, title) => {
    t.title = String(title || '');
    sendRenderer('tabs:updated', listTabs());
  });
  
  // Inject theme CSS when page loads
  v.webContents.on('did-finish-load', () => {
    try {
      // Apply theme immediately using the stored theme
      applyThemeToWebContents(v.webContents, currentTheme);
    } catch {}
  });
  
  // Also apply theme on navigation
  v.webContents.on('did-navigate', () => {
    try {
      // Apply theme immediately using the stored theme
      applyThemeToWebContents(v.webContents, currentTheme);
    } catch {}
  });
  
  // Apply theme on dom-ready as well for faster application
  v.webContents.on('dom-ready', () => {
    try {
      // Apply theme immediately using the stored theme
      applyThemeToWebContents(v.webContents, currentTheme);
    } catch {}
  });
  v.webContents.on('did-navigate', async (_e, urlStr) => {
    t.url = String(urlStr || '');
    try {
      const title = await v.webContents.getTitle();
      historyService?.recordVisit(t.url, title || t.url);
    } catch {}
    sendRenderer('tabs:updated', listTabs());
    // If this is the active tab, broadcast canonical URL
    if (t.id === activeTabId) {
      try {
        const isSearch = await v.webContents.executeJavaScript('!!window.__COMET_IS_SEARCH_PAGE').catch(() => false);
        if (isSearch) {
          const q = await v.webContents.executeJavaScript('window.__COMET_SEARCH_CONTEXT && window.__COMET_SEARCH_CONTEXT.query').catch(() => '');
          if (q) sendRenderer('tab:url-changed', `comet:search?q=${encodeURIComponent(q)}`);
          else sendRenderer('tab:url-changed', t.url);
        } else {
          sendRenderer('tab:url-changed', t.url);
        }
      } catch {}
    }
  });
  v.webContents.on('did-navigate-in-page', async (_e, urlStr) => {
    t.url = String(urlStr || '');
    try { mainWindow?.webContents.send('tabs:updated', listTabs()); } catch {}
    if (t.id === activeTabId) {
      try {
        const isSearch = await v.webContents.executeJavaScript('!!window.__COMET_IS_SEARCH_PAGE').catch(() => false);
        if (isSearch) {
          const q = await v.webContents.executeJavaScript('window.__COMET_SEARCH_CONTEXT && window.__COMET_SEARCH_CONTEXT.query').catch(() => '');
          if (q) return sendRenderer('tab:url-changed', `comet:search?q=${encodeURIComponent(q)}`);
        }
        sendRenderer('tab:url-changed', t.url);
      } catch {}
    }
  });
  // Find-in-page events forward only when active
  v.webContents.on('found-in-page', (_e, result) => {
    if (t.id !== activeTabId) return;
    sendRenderer('find:result', result);
  });

  // Register context-menu for this view
  v.webContents.on('context-menu', (_e, params) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Back', enabled: v.webContents.canGoBack(), click: () => v.webContents.goBack() },
      { label: 'Forward', enabled: v.webContents.canGoForward(), click: () => v.webContents.goForward() },
      { label: 'Reload', click: () => v.webContents.reload() },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'selectAll' },
      { type: 'separator' },
      { label: 'Inspect Element', click: () => v.webContents.inspectElement(params.x, params.y) },
    ]);
    menu.popup({ window: mainWindow! });
  });

  // Open links: http(s) in-app, otherwise delegate to OS
  v.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (/^https?:\/\//i.test(url)) {
        v.webContents.loadURL(url);
      } else {
        shell.openExternal(url).catch(() => {});
      }
    } catch {}
    return { action: 'deny' };
  });

  // Load start page or URL
  (async () => {
    try {
      if (initialUrl && initialUrl.trim()) {
        // Handle special URLs differently
        if (initialUrl.startsWith('about:')) {
          // For about: URLs, we'll just set the tab URL but not actually load it in the BrowserView
          // The renderer will detect this and show appropriate content
          t.url = initialUrl;
          // Send URL changed event immediately
          sendRenderer('tabs:updated', listTabs());
          sendRenderer('tab:url-changed', initialUrl);
        } else {
          // Regular URLs load normally
          await v.webContents.loadURL(initialUrl);
        }
      }
      else await v.webContents.loadURL('https://example.com');
    } catch {}
  })();

  // Ensure the active view is attached once the renderer UI is ready
  try {
    if (mainWindow) {
      const wc = mainWindow.webContents;
      wc.on('did-finish-load', () => attachViewIfReady());
      wc.on('dom-ready', () => attachViewIfReady());
    }
  } catch {}
  // Also schedule a couple of delayed attempts to cover race conditions
  try { setTimeout(() => attachViewIfReady(), 50); } catch {}
  try { setTimeout(() => attachViewIfReady(), 300); } catch {}
  
  // Set initial background color based on system preference and apply theme
  try {
    const isDarkMode = nativeTheme?.shouldUseDarkColors ?? true;
    const initialColor = isDarkMode ? '#09090b' : '#ffffff';
    v.setBackgroundColor(initialColor);
    
    // Apply theme immediately
    applyThemeToWebContents(v.webContents, currentTheme);
  } catch {}

  // Activate
  activateTab(id);
  sendRenderer('tabs:updated', listTabs());
  return t;
}

function closeTab(id: string) {
  const idx = tabs.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const [removed] = tabs.splice(idx, 1);
  try {
    if (mainWindow) {
      const views = (mainWindow as any).getBrowserViews?.() || [];
      if (views.includes(removed.view)) mainWindow.setBrowserView(null as any);
    }
  } catch {}
  if (activeTabId === id) {
    const next = tabs[idx] || tabs[idx - 1] || tabs[0] || null;
    if (next) activateTab(next.id);
    else {
      view = null; activeTabId = null;
      try { mainWindow?.setBrowserView(null as any); } catch {}
    }
  }
  sendRenderer('tabs:updated', listTabs());
}

function listTabs() {
  return tabs.map((t) => ({ id: t.id, title: t.title || (t.url || 'New Tab'), url: t.url, active: t.id === activeTabId }));
}
let config: AppConfig;

function isUrl(input: string): boolean {
  // Heuristic: only treat as URL if it has a scheme, a dot in hostname, localhost, or an IP
  const s = (input || '').trim();
  if (!s) return false;
  if (s.includes('://')) return true;
  if (/^localhost(?:\:\d+)?(?:\/|$)/i.test(s)) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(s)) return true; // IPv4
  if (s.includes('.') && !/\s/.test(s)) return true;
  return false;
}

async function createWindow() {
  ensureConfigDir();
  config = loadConfig();
  // Dev-only: Service worker DBs can get locked during frequent reloads. Clearing avoids noisy errors.
  if (process.env.NODE_ENV !== 'production') {
    try {
      await session.defaultSession.clearStorageData({ storages: ['serviceworkers'] });
    } catch {}
  }
  const db = getDb();
  const bookmarks = new BookmarksService(db);
  historyService = new HistoryService(db);
  const ai = new AiService(config);
  const search = new SearchService(config);
  const indexer = new IndexerService(config, db);
  indexer.start().catch(() => {});
  const importer = new ImportService(bookmarks, historyService!);

  // Privacy: simple ad/tracker blocker
  if (config.privacy?.adBlocker === 'enabled') {
    const blockedSubstrings = [
      'doubleclick.net',
      'googlesyndication.com',
      'googletagservices.com',
      'googletagmanager.com/gtm.js',
      'adservice.google',
      'adnxs.com',
      'facebook.com/tr',
      '/ads?',
      '/advert',
      'taboola.com',
      'outbrain.com',
    ];
    // Allowlist for resources YouTube legitimately needs (thumbnails, media, static)
    const allowSubstrings = [
      'ytimg.com',              // thumbnails/static
      'i.ytimg.com',
      'i9.ytimg.com',
      'yt3.ggpht.com',
      'googlevideo.com',        // media segments
      '.googlevideo.com',       // any subdomain
      'youtubei.googleapis.com',// API
      'gstatic.com',            // static assets
    ];
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
      const url = details.url || '';
      // Never block if URL matches allowlist
      if (allowSubstrings.some((s) => url.includes(s))) return cb({});
      // Otherwise block known ad/tracker URLs
      if (blockedSubstrings.some((s) => url.includes(s))) return cb({ cancel: true });
      cb({});
    });

  // Application menu with common shortcuts
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Print…', accelerator: 'Ctrl+P', click: () => view?.webContents.print({}) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'Ctrl+R', click: () => view?.webContents.reload() },
        { label: 'Back', accelerator: 'Alt+Left', click: () => view?.webContents.goBack() },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => view?.webContents.goForward() },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'Ctrl+Plus', click: () => view && view.webContents.setZoomLevel(view.webContents.getZoomLevel() + 0.5) },
        { label: 'Zoom Out', accelerator: 'Ctrl+-', click: () => view && view.webContents.setZoomLevel(view.webContents.getZoomLevel() - 0.5) },
        { label: 'Reset Zoom', accelerator: 'Ctrl+0', click: () => view && view.webContents.setZoomLevel(0) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Toggle DevTools', accelerator: 'Ctrl+Shift+I', click: () => {
            try {
              const active = getActiveTab();
              if (active && typeof active.url === 'string' && active.url.startsWith('about:')) {
                mainWindow?.webContents.openDevTools({ mode: 'right' });
              } else if (view) {
                view.webContents.openDevTools({ mode: 'right' });
              } else {
                mainWindow?.webContents.openDevTools({ mode: 'right' });
              }
            } catch {}
          } },
      ],
    },
  ];
  try { Menu.setApplicationMenu(Menu.buildFromTemplate(template)); } catch {}

  // Downloads control IPCs
  ipcMain.handle('downloads:list', async () => {
    const list: Array<{ id: string; filename: string; receivedBytes: number; totalBytes: number; paused: boolean; canResume: boolean; state: string; savePath: string }> = [];
    for (const [id, it] of downloadItems.entries()) {
      list.push({
        id,
        filename: it.getFilename(),
        receivedBytes: it.getReceivedBytes(),
        totalBytes: it.getTotalBytes(),
        paused: it.isPaused(),
        canResume: it.canResume(),
        state: (it as any).getState?.() || 'progressing',
        savePath: it.getSavePath(),
      });
    }
    return list;
  });
  ipcMain.handle('downloads:pause', async (_e: IpcMainInvokeEvent, id: string) => { const it = downloadItems.get(id); if (it && !it.isPaused()) try { it.pause(); } catch {} });
  ipcMain.handle('downloads:resume', async (_e: IpcMainInvokeEvent, id: string) => { const it = downloadItems.get(id); if (it && it.canResume()) try { it.resume(); } catch {} });
  ipcMain.handle('downloads:cancel', async (_e: IpcMainInvokeEvent, id: string) => { const it = downloadItems.get(id); if (it) try { it.cancel(); } catch {} });
  ipcMain.handle('downloads:show-in-folder', async (_e: IpcMainInvokeEvent, id: string) => { const it = downloadItems.get(id); if (it) try { shell.showItemInFolder(it.getSavePath()); } catch {} });
  ipcMain.handle('downloads:open-file', async (_e: IpcMainInvokeEvent, id: string) => { const it = downloadItems.get(id); if (it) try { shell.openPath(it.getSavePath()); } catch {} });
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#09090b', // Default to dark theme background
    show: false,
  });
  
  // Context menu for renderer window (enables Inspect Element on special pages like Tool Playground)
  try {
    mainWindow.webContents.on('context-menu', (_e, params) => {
      const menu = Menu.buildFromTemplate([
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Inspect Element', click: () => mainWindow?.webContents.inspectElement(params.x, params.y) },
      ]);
      menu.popup({ window: mainWindow! });
    });
  } catch {}

  // Using the currentTheme variable defined at the top of the file

  // Reader mode (basic)
  let isReaderMode = false;
  let lastUrlBeforeReader = '' as string;
  ipcMain.handle('reader:toggle', async () => {
    try {
      if (!view) return;
      // Wait for the page to be ready to avoid executeJavaScript throwing during navigations
      try { await ensureWebContentsReady(view.webContents); } catch {}
      if (!isReaderMode) {
        let currentUrl = '';
        let title = '';
        try { currentUrl = (await view.webContents.getURL()) || ''; } catch {}
        try { title = (await view.webContents.getTitle()) || ''; } catch {}
        lastUrlBeforeReader = currentUrl;
        let pageText = '' as string;
        try {
          pageText = await view.webContents.executeJavaScript(`(function(){
          try {
            var chunks = [];
            var push = function(t){ var s = (t==null? '' : String(t)); if (s && s.trim()) chunks.push(s.trim()); };
            // 1) Custom readable helper if present
            try { push(window.__comet_getReadableText && window.__comet_getReadableText()); } catch (e) {}
            // 2) Semantic containers
            var pick = function(sel){ try { var el = document.querySelector(sel); return el ? (el.innerText || el.textContent || '') : ''; } catch (e) { return ''; } };
            push(pick('article'));
            push(pick('main'));
            push(pick('#search'));
            push(pick('#content'));
            push(pick('#primary'));
            // 3) Fallback to full body text
            try { push((document && document.body && (document.body.innerText || document.body.textContent)) || ''); } catch (e) {}
            return chunks.join('\n\n');
          } catch (e) { return ''; }
        })()`);
        } catch {}
        if (!pageText) {
          try { pageText = await view.webContents.executeJavaScript('(document && document.body && document.body.innerText) || ""'); } catch {}
        }
        const safe = (s: any) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${safe(title)}</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
          <style>
          body{font:16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; background:#f9fafb; color:#111827;}
          .container{max-width:720px;margin:40px auto;padding:0 16px}
          h1{font-size:28px;margin-bottom:16px}
          pre{white-space:pre-wrap}
          </style>
        </head><body><div class="container"><h1>${safe(title)}</h1><pre>${safe(pageText || 'No readable text detected for this page.')}</pre></div></body></html>`;
        try { await view.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)); } catch {}
        isReaderMode = true;
      } else {
        if (lastUrlBeforeReader) { try { await view.webContents.loadURL(lastUrlBeforeReader); } catch {} }
        isReaderMode = false;
      }
    } catch (e) {
      // Swallow errors to avoid rejecting the IPC call
      console.error('reader:toggle error', e);
      return null;
    }
  });
  
  // Create first tab
  createTab('https://example.com');

  // Context menu is registered per-tab in createTab()

  // Core: Downloads handling
  const downloadItems = new Map<string, Electron.DownloadItem>();
  session.defaultSession.on('will-download', (event, item, webContents) => {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      downloadItems.set(id, item);
      const filename = item.getFilename();
      const savePath = path.join(app.getPath('downloads'), filename);
      item.setSavePath(savePath);
      const send = (channel: string, payload: any) => sendRenderer(channel, payload);
      send('downloads:started', { id, filename, mime: item.getMimeType(), totalBytes: item.getTotalBytes(), savePath });
      item.on('updated', (_e, state) => {
        send('downloads:updated', {
          id,
          state,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          paused: item.isPaused(),
          canResume: item.canResume(),
          savePath: item.getSavePath(),
        });
      });
      item.once('done', (_e, state) => {
        send('downloads:done', { id, state, savePath: item.getSavePath() });
        downloadItems.delete(id);
      });
    } catch {}
  });

  // Core: Permissions scaffold (default deny; wire for future UI)
  session.defaultSession.setPermissionRequestHandler((_wc, permission, _cb) => {
    // For now, deny by default to be safe. Later, surface UI via IPC and consult config.
    try { sendRenderer('permissions:requested', { permission }); } catch {}
    _cb(false);
  });

  // Legacy single-view URL broadcaster removed to avoid cross-tab URL updates.

  // IPC handlers
  // Allow renderer to temporarily hide/show the BrowserView (e.g., for modal overlays)
  ipcMain.handle('view:set-visible', (_e: IpcMainInvokeEvent, visible: boolean) => {
    if (!mainWindow || !view) return;
    try {
      if (visible) {
        // Re-attach if missing and restore bounds
        const hasView = BrowserWindow.getAllWindows()
          .some((w) => w === mainWindow && (w as any).getBrowserViews?.().includes(view!));
        if (!hasView) attachViewIfReady(); else attachViewIfReady();
      } else {
        // Detach to ensure renderer webContents is on top
        mainWindow.setBrowserView(null);
      }
    } catch {}
  });

  // Open devtools docked to the right for the currently focused contents
  ipcMain.handle('devtools:open', () => {
    try {
      const focused = BrowserWindow.getFocusedWindow();
      if (focused) focused.webContents.openDevTools({ mode: 'right' });
      else if (view) view.webContents.openDevTools({ mode: 'right' });
    } catch {}
  });
  // Alias for preload API compatibility
  ipcMain.handle('open-dev-tools', () => {
    try {
      const focused = BrowserWindow.getFocusedWindow();
      if (focused) focused.webContents.openDevTools({ mode: 'right' });
      else if (view) view.webContents.openDevTools({ mode: 'right' });
    } catch {}
  });

  // Handle element inspection for a specific tab
  ipcMain.handle('inspect-element', async (_event, tabId: string) => {
    try {
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) throw new Error(`Tab ${tabId} not found`);
      
      // Enable DevTools if not already open
      if (!tab.view.webContents.isDevToolsOpened()) {
        tab.view.webContents.openDevTools({ mode: 'right' });
      }
      
      // Toggle inspect element mode
      tab.view.webContents.inspectElement(0, 0);
    } catch (error) {
      console.error('Error in inspect-element handler:', error);
      throw error;
    }
  });
  
  // Tool Playground IPC handlers removed - using alternative implementation
  // Fallback URL builder for provider HTML pages
  function buildFallbackSearchUrl(q: string): string {
    const enc = encodeURIComponent(q);
    const p = search.getProvider();
    if (p === 'searxng') {
      const base = (config.search.searxng?.baseUrl || '').replace(/\/$/, '');
      if (base) return `${base}/search?q=${enc}`;
    }
    return '';
  }

  ipcMain.handle('omnibox:navigate', async (_ev: IpcMainInvokeEvent, { url: input, tabId }: { url: string, tabId?: string }) => {
    try {
      const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
      if (!targetView) throw new Error(`Tab ${tabId || 'active'} not found`);
      
      const s = (input || '').trim();
      if (!s) return { url: '', tabId };
      
      if (isUrl(s)) {
        const url = s.includes('://') ? s : `https://${s}`; // prefer HTTPS for bare hosts
        await targetView.webContents.loadURL(url);
        
        // Update the tab's URL in our records
        const tab = tabs.find(t => t.view === targetView);
        if (tab) {
          tab.url = url;
          tab.title = targetView.webContents.getTitle();
        }
        
        // Only send URL change if this is the active tab
        if (tab && tab.id === activeTabId) {
          sendRenderer('tab:url-changed', url);
        }
        return { url, tabId: tab?.id };
      }
      // Build in-app search results page with summary & citations
      try {
        const resp = await search.searchWeb(s); // includes summary & suggestions
        const safe = (t: string) => (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const title = `Comet — Results for "${safe(s)}"`;
        const provider = search.getProvider();
        const resultsHtml = resp.results
          .map((r, i) => {
            const n = i + 1;
            const host = (() => { try { return new URL(r.url).host; } catch { return ''; } })();
            return `
              <li id="cite-${n}" class="mb-4">
                <div class="text-sm text-gray-500">[${n}] ${safe(host)}</div>
                <a class="text-blue-700 text-lg hover:underline" href="${safe(r.url)}">${safe(r.title)}</a>
                <div class="text-sm text-gray-700 mt-1">${safe(r.description || '')}</div>
                <div class="text-xs text-gray-500 truncate">${safe(r.url)}</div>
              </li>`;
          })
          .join('\n');
        const suggHtml = (resp.suggestions || [])
          .map((sug) => {
            const sugLit = JSON.stringify(sug).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
            return `<li class="mb-1"><button class="linklike" onclick="(window.__comet_navigateSearch||function(q){location.hash='?q='+encodeURIComponent(q)} )(${sugLit})">${safe(sug)}</button></li>`;
          })
          .join('\n');
        const ctx = JSON.stringify({ query: resp.query, results: resp.results })
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e')
          .replace(/&/g, '\\u0026');
        const html = `<!doctype html><html><head><meta charset="utf-8" />
          <title>${title}</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
          <style>
            body{font:15px/1.6 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; background:#fff; color:#111827;}
            .container{max-width:880px;margin:24px auto;padding:0 16px}
            h1{font-size:20px;margin:0 0 8px 0}
            .muted{color:#6b7280;font-size:12px}
            .summary{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;white-space:pre-wrap}
            a{color:#1d4ed8}
            .linklike{background:none;border:0;padding:0;margin:0;color:#1d4ed8;cursor:pointer;text-decoration:underline;font:inherit}
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Results for "${safe(resp.query)}"</h1>
            ${provider === 'searxng' ? '' : (resp.summary ? `<div class="summary">${safe(resp.summary)}</div>` : '')}
            <h2 style="margin-top:16px;font-size:16px">Citations</h2>
            <ol style="list-style:none;padding-left:0">${resultsHtml}</ol>
            ${suggHtml ? `<div style="margin-top:12px"><div class="muted">Suggestions</div><ul>${suggHtml}</ul></div>` : ''}
          </div>
          <script>
            // Mark page as Comet search page and expose context for the assistant
            window.__COMET_IS_SEARCH_PAGE = true;
            window.__COMET_SEARCH_CONTEXT = JSON.parse('${ctx}');
          </script>
        </body></html>`;
        await targetView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        
        // Update the tab's URL in our records
        const searchTab = tabs.find(t => t.view === targetView);
        const searchUrl = `comet:search?q=${encodeURIComponent(s)}`;
        
        if (searchTab) {
          searchTab.url = searchUrl;
          searchTab.title = `Search: ${s}`;
        }
        
        // Only broadcast URL change if this is the active tab
        if (searchTab && searchTab.id === activeTabId) {
          sendRenderer('tab:url-changed', searchUrl);
        }
        
        return { url: searchUrl, tabId: searchTab?.id };
      } catch (searchErr) {
        console.error('Search failed:', searchErr);
        // Fallback to provider-hosted HTML search if API/summary fails
        const fallbackUrl = buildFallbackSearchUrl(s);
        if (fallbackUrl) {
          await targetView.webContents.loadURL(fallbackUrl);
          
          // Update the tab's URL in our records
          const fallbackTab = tabs.find(t => t.view === targetView);
          if (fallbackTab) {
            fallbackTab.url = fallbackUrl;
            fallbackTab.title = targetView.webContents.getTitle();
          }
          
          // Only broadcast URL change if this is the active tab
          if (fallbackTab && fallbackTab.id === activeTabId) {
            sendRenderer('tab:url-changed', fallbackUrl);
          }
          return { url: fallbackUrl, tabId: fallbackTab?.id };
        }
        throw searchErr; // Re-throw if we couldn't handle the fallback
      }
    } catch (err) {
      // Avoid silent failures
      console.error('omnibox:navigate failed', err);
    }
  });

  ipcMain.handle('tab:back', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string } = {}) => {
    const targetTabId = tabId || activeTabId;
    const targetTab = targetTabId ? tabs.find(t => t.id === targetTabId) : null;
    const targetView = targetTab?.view;
    
    if (!targetView) return `No tab found for ${targetTabId || 'active'}`;
    
    await targetView.webContents.goBack();
    
    // Update tab URL after navigation
    const newUrl = targetView.webContents.getURL();
    if (targetTab && newUrl) {
      targetTab.url = newUrl;
      targetTab.title = targetView.webContents.getTitle() || targetTab.title;
      
      // Only send URL change if this is the active tab
      if (targetTabId === activeTabId) {
        sendRenderer('tab:url-changed', newUrl);
      }
    }
    
    return `Navigated back in tab ${targetTabId || 'active'}`;
  });

  ipcMain.handle('tab:forward', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string } = {}) => {
    const targetTabId = tabId || activeTabId;
    const targetTab = targetTabId ? tabs.find(t => t.id === targetTabId) : null;
    const targetView = targetTab?.view;
    
    if (!targetView) return `No tab found for ${targetTabId || 'active'}`;
    
    await targetView.webContents.goForward();
    
    // Update tab URL after navigation
    const newUrl = targetView.webContents.getURL();
    if (targetTab && newUrl) {
      targetTab.url = newUrl;
      targetTab.title = targetView.webContents.getTitle() || targetTab.title;
      
      // Only send URL change if this is the active tab
      if (targetTabId === activeTabId) {
        sendRenderer('tab:url-changed', newUrl);
      }
    }
    
    return `Navigated forward in tab ${targetTabId || 'active'}`;
  });

  ipcMain.handle('tab:reload', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string } = {}) => {
    const targetTabId = tabId || activeTabId;
    const targetTab = targetTabId ? tabs.find(t => t.id === targetTabId) : null;
    const targetView = targetTab?.view;
    
    if (!targetView) return `No tab found for ${targetTabId || 'active'}`;
    
    await targetView.webContents.reload();
    
    // Update tab URL after reload (in case it changed)
    const newUrl = targetView.webContents.getURL();
    if (targetTab && newUrl) {
      targetTab.url = newUrl;
      targetTab.title = targetView.webContents.getTitle() || targetTab.title;
      
      // Only send URL change if this is the active tab
      if (targetTabId === activeTabId) {
        sendRenderer('tab:url-changed', newUrl);
      }
    }
    
    return `Reloaded tab ${targetTabId || 'active'}`;
  });
  // Tabs IPC
  ipcMain.handle('tabs:create', async (_e: IpcMainInvokeEvent, url?: string) => { const t = createTab(url); return t ? { id: t.id } : undefined; });
  ipcMain.handle('tabs:list', async () => listTabs());
  ipcMain.handle('tabs:activate', async (_e: IpcMainInvokeEvent, id: string) => { activateTab(id); return listTabs(); });
  ipcMain.handle('tabs:close', async (_e: IpcMainInvokeEvent, id: string) => { closeTab(id); return listTabs(); });
  // Core: Find-in-page
  ipcMain.handle('find:start', async (_e: IpcMainInvokeEvent, text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) => {
    if (!view || !text) return;
    try { await view.webContents.findInPage(text, options || {}); } catch {}
  });
  ipcMain.handle('find:stop', async (_e: IpcMainInvokeEvent, action: 'clearSelection' | 'keepSelection' | 'activateSelection' = 'clearSelection') => {
    if (!view) return;
    try { view.webContents.stopFindInPage(action); } catch {}
  });
  view?.webContents.on('found-in-page', (_e, result) => {
    sendRenderer('find:result', result);
  });
  // Core: Zoom controls
  ipcMain.handle('tab:get-url', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string } = {}) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    if (!targetView) return undefined;
    
    try {
      // Check if this is a search page
      const isSearch = await targetView.webContents.executeJavaScript('window.__COMET_IS_SEARCH_PAGE || false');
      if (isSearch) {
        const q = await targetView.webContents.executeJavaScript('window.__COMET_SEARCH_CONTEXT && window.__COMET_SEARCH_CONTEXT.query');
        if (q) return `comet:search?q=${encodeURIComponent(q)}`;
      }
      return targetView.webContents.getURL();
    } catch (e) {
      console.error('Error getting URL:', e);
      return targetView.webContents.getURL();
    }
  });

  ipcMain.handle('tab:execute-script', async (_e: IpcMainInvokeEvent, { script, tabId }: { script: string, tabId?: string }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    if (!targetView) throw new Error(`Tab ${tabId || 'active'} not found`);
    return targetView.webContents.executeJavaScript(script);
  });

  ipcMain.handle('zoom:get', async () => (view ? view.webContents.getZoomLevel() : 0));
  ipcMain.handle('zoom:set', async (_e: IpcMainInvokeEvent, level: number) => { if (view && Number.isFinite(level)) view.webContents.setZoomLevel(level); return view?.webContents.getZoomLevel(); });
  ipcMain.handle('zoom:reset', async () => { if (view) view.webContents.setZoomLevel(0); return view?.webContents.getZoomLevel(); });
  ipcMain.handle('zoom:in', async () => { if (view) view.webContents.setZoomLevel(view.webContents.getZoomLevel() + 0.5); return view?.webContents.getZoomLevel(); });
  ipcMain.handle('zoom:out', async () => { if (view) view.webContents.setZoomLevel(view.webContents.getZoomLevel() - 0.5); return view?.webContents.getZoomLevel(); });
  // Core: Privacy - clear browsing data
  ipcMain.handle('privacy:clear-browsing-data', async (_e: IpcMainInvokeEvent, opts?: { cache?: boolean; cookies?: boolean; storage?: boolean }) => {
    const o = opts || {};
    try {
      if (o.cache) await session.defaultSession.clearCache();
    } catch {}
    try {
      if (o.cookies) await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    } catch {}
    try {
      if (o.storage) await session.defaultSession.clearStorageData({ storages: ['localstorage','serviceworkers','shadercache','indexdb','websql','cachestorage'] });
    } catch {}
    return true;
  });
  // DOM Parsing APIs
  ipcMain.handle('dom:extract-element', async (_e: IpcMainInvokeEvent, { tabId, selector, options }: { tabId?: string, selector: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return DOMUtils.extractElement(targetView, selector, options);
  });

  ipcMain.handle('dom:extract-table', async (_e: IpcMainInvokeEvent, { tabId, selector, options }: { tabId?: string, selector: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return DOMUtils.extractTable(targetView, selector, options);
  });

  ipcMain.handle('dom:extract-images', async (_e: IpcMainInvokeEvent, { tabId, selector, options }: { tabId?: string, selector?: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return DOMUtils.extractImages(targetView, selector, options);
  });

  ipcMain.handle('dom:extract-links', async (_e: IpcMainInvokeEvent, { tabId, selector, options }: { tabId?: string, selector?: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return DOMUtils.extractLinks(targetView, selector, options);
  });

  ipcMain.handle('dom:extract-meta', async (_e: IpcMainInvokeEvent, { tabId, options }: { tabId?: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return DOMUtils.extractMeta(targetView, options);
  });

  // Semantic Extraction APIs
  ipcMain.handle('semantic:extract', async (_e: IpcMainInvokeEvent, { tabId, options }: { tabId?: string, options: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return SemanticUtils.semanticExtract(targetView, options);
  });

  ipcMain.handle('semantic:summarize', async (_e: IpcMainInvokeEvent, { tabId, options }: { tabId?: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return SemanticUtils.summarize(targetView, options);
  });

  ipcMain.handle('semantic:recognize-entities', async (_e: IpcMainInvokeEvent, { tabId, options }: { tabId?: string, options?: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return SemanticUtils.recognizeEntities(targetView, options);
  });

  ipcMain.handle('semantic:classify', async (_e: IpcMainInvokeEvent, { tabId, options }: { tabId?: string, options: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return SemanticUtils.classify(targetView, options);
  });

  ipcMain.handle('semantic:extract-table', async (_e: IpcMainInvokeEvent, { tabId, options }: { tabId?: string, options: any }) => {
    const targetView = tabId ? tabs.find(t => t.id === tabId)?.view : view;
    return SemanticUtils.extractSemanticTable(targetView, options);
  });

  // Core: Print and PDF
  ipcMain.handle('tab:print', async () => { if (!view) return; try { view.webContents.print({}); } catch {} });
  ipcMain.handle('tab:print-to-pdf', async () => {
    if (!view) return undefined;
    try {
      const pdf = await view.webContents.printToPDF({ printBackground: true });
      // Save to temp and reveal
      const file = path.join(app.getPath('downloads'), `page-${Date.now()}.pdf`);
      await require('fs').promises.writeFile(file, pdf);
      try { shell.showItemInFolder(file); } catch {}
      return file;
    } catch (e) {
      return undefined;
    }
  });

  // Expose current in-app search context to the renderer (used for citation navigation)
  ipcMain.handle('tab:get-search-context', async () => {
    if (!view) return undefined;
    try {
      const isSearch = await view.webContents.executeJavaScript('!!window.__COMET_IS_SEARCH_PAGE').catch(() => false);
      if (!isSearch) return undefined;
      const ctx = await view.webContents.executeJavaScript('window.__COMET_SEARCH_CONTEXT').catch(() => undefined);
      return ctx;
    } catch {
      return undefined;
    }
  });

  // Scroll to citation item on search page
  ipcMain.handle('tab:scroll-to-citation', async (_e: IpcMainInvokeEvent, n: number) => {
    if (!view || typeof n !== 'number' || !Number.isFinite(n)) return;
    try {
      const isSearch = await view.webContents.executeJavaScript('!!window.__COMET_IS_SEARCH_PAGE').catch(() => false);
      if (!isSearch) return;
      const code = `(function(){ var el = document.getElementById('cite-${n}'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); })()`;
      await view.webContents.executeJavaScript(code);
    } catch {}
  });

  ipcMain.handle('layout:set', async (_e: IpcMainInvokeEvent, layout: { top: number; rightSidebarWidth: number }) => {
    if (!mainWindow || !view) { layoutTop = layout.top || layoutTop; layoutRight = layout.rightSidebarWidth ?? layoutRight; return; }
    const { width, height } = mainWindow.getBounds();
    layoutTop = Math.max(0, layout.top);
    layoutRight = Math.max(0, Math.min(layout.rightSidebarWidth, Math.floor(width * 0.6)));
    view.setBounds({ x: 0, y: layoutTop, width: Math.max(0, width - layoutRight), height: Math.max(0, height - layoutTop) });
    // Also re-attach in case the view got dropped during reloads
    attachViewIfReady();
  });

  ipcMain.handle('search:web', async (_e: IpcMainInvokeEvent, query: string) => search.searchWeb(query));
  ipcMain.handle('search:brave', async (_e: IpcMainInvokeEvent, query: string) => search.searchWeb(query));
  ipcMain.handle('search:local', async (_e: IpcMainInvokeEvent, query: string) => indexer.searchLocal(query));

  // Provider controls
  ipcMain.handle('search:get-provider', async () => search.getProvider());
  ipcMain.handle(
    'search:set-provider',
    async (_e: IpcMainInvokeEvent, provider: AppConfig['search']['provider']) => {
      const allowed: AppConfig['search']['provider'][] = ['auto', 'brave', 'searxng', 'google', 'bing', 'presearch'];
      if (!allowed.includes(provider)) throw new Error('Invalid provider');
      search.setProvider(provider);
      return search.getProvider();
    }
  );

  // Handle theme-based background color changes
  ipcMain.on('set-background-color', (_e: ElectronEvent, color: string, themeName?: string) => {
    try {
      if (mainWindow && color) {
        // Store current theme for immediate application to new tabs
        if (themeName) {
          currentTheme = themeName;
        }
        
        mainWindow.setBackgroundColor(color);
        
        // Also update all browser views with the same background color
        tabs.forEach(tab => {
          try {
            if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
              tab.view.setBackgroundColor(color);
              
              // Re-inject CSS with the new theme
              applyThemeToWebContents(tab.view.webContents, themeName);
            }
          } catch {}
        });
        
        // Update the active view
        if (view) {
          try {
            view.setBackgroundColor(color);
          } catch {}
        }
      }
    } catch {}
  });
  
  // Using the applyThemeToWebContents function defined at the top of the file

  // Onboarding flags (first-run wizard gating)
  ipcMain.handle('onboarding:get', async () => config.onboarding || { showImportOnFirstRun: false, importCompleted: true });
  ipcMain.handle('onboarding:set', async (_e: IpcMainInvokeEvent, patch: Partial<AppConfig['onboarding']>) => {
    config = {
      ...config,
      onboarding: {
        ...(config.onboarding || { showImportOnFirstRun: true, importCompleted: false }),
        ...(patch || {}),
      },
    };
    try { saveConfig(config); } catch {}
    return config.onboarding;
  });

  ipcMain.handle('ai:chat', async (
    _e: IpcMainInvokeEvent,
    payload: { messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; options?: { includePage?: boolean } }
  ) => {
    let messages = payload.messages;
    let searchCtx: { query: string; results: { title: string; description: string; url: string }[] } | null = null;
    if (view) {
      try {
        // Detect in-app search results page and extract context
        const isSearch = await view.webContents.executeJavaScript('!!window.__COMET_IS_SEARCH_PAGE');
        if (isSearch) {
          searchCtx = await view.webContents.executeJavaScript('window.__COMET_SEARCH_CONTEXT');
        }
      } catch {}
    }

    if (searchCtx && Array.isArray(searchCtx.results) && searchCtx.results.length) {
      const lines = searchCtx.results.slice(0, 12).map((r, i) => `${i + 1}. ${r.title} — ${r.description}\n${r.url}`);
      messages = [
        { role: 'system', content: 'You are a research assistant. Ground answers in the provided web results. When asserting facts, cite with [n] where n is the index of the cited result. If information is insufficient, say what else is needed.' },
        { role: 'user', content: `Web search results for "${searchCtx.query}":\n\n${lines.join('\n\n')}` },
        ...messages,
      ];
    } else if (payload.options?.includePage && view) {
      // Fallback to page content extraction
      let pageText: string = await view.webContents.executeJavaScript('window.__comet_getReadableText && window.__comet_getReadableText()');
      if (!pageText) {
        // Basic fallback to visible text
        try { pageText = await view.webContents.executeJavaScript('(document && document.body && document.body.innerText) || ""'); } catch {}
      }
      messages = [
        { role: 'system', content: 'You are a helpful browsing assistant. Use the provided page content when relevant.' },
        { role: 'user', content: `Page content:\n${(pageText || '').slice(0, 12000)}` },
        ...messages,
      ];
    }

    const result = await ai.chat(messages);
    return result;
  });

  // Bookmarks
  ipcMain.handle('bookmarks:add', (_e: IpcMainInvokeEvent, { title, url, tags }: { title: string; url: string; tags?: string[] }) => bookmarks.add(title, url, tags));
  ipcMain.handle('bookmarks:list', () => bookmarks.list());
  ipcMain.handle('bookmarks:remove', (_e: IpcMainInvokeEvent, id: number) => bookmarks.remove(id));
  ipcMain.handle('bookmarks:toggle', async (_e: IpcMainInvokeEvent, url: string) => {
    const existing = bookmarks.findByUrl(url);
    if (existing) return bookmarks.remove(existing.id), { toggled: 'removed' };
    const title = await view?.webContents.getTitle();
    return bookmarks.add(title || url, url), { toggled: 'added' };
  });

  // History
  ipcMain.handle('history:list', (_e: IpcMainInvokeEvent, opts?: { limit?: number; offset?: number; prefix?: string }) => historyService!.list(opts));
  ipcMain.handle('history:suggest', (_e: IpcMainInvokeEvent, prefix: string) => historyService!.suggest(prefix));

  // Helper: apply cookies from our local DB into Electron session
  async function applyImportedCookiesToSession() {
    try {
      const db = getDb();
      const rows = db
        .prepare(
          'SELECT host, name, value, path, expiresAt, secure, httpOnly, sameSite FROM cookies'
        )
        .all() as Array<{
          host: string;
          name: string;
          value: Buffer | string | null;
          path: string;
          expiresAt: number | null;
          secure: number;
          httpOnly: number;
          sameSite: string | null;
        }>;

      for (const r of rows) {
        const isSecure = Number(r.secure || 0) === 1;
        const scheme = isSecure ? 'https' : 'http';
        const host = String(r.host || '').trim();
        if (!host) continue;
        const bareHost = host.replace(/^\./, '');
        const val = Buffer.isBuffer(r.value) ? r.value.toString() : (r.value ?? '');

        // Build a small set of target URLs to maximize applicability (handles domain cookies and common subdomains)
        const targets = new Set<string>();
        targets.add(`${scheme}://${bareHost}`);
        // If it was a domain cookie like .google.com, also target common subdomains
        if (host.startsWith('.')) {
          for (const sub of ['www', 'accounts']) {
            targets.add(`${scheme}://${sub}.${bareHost}`);
          }
        }

        for (const url of targets) {
          const details: any = {
            url,
            name: String(r.name || ''),
            value: String(val || ''),
            domain: host || undefined,
            path: r.path || '/',
            secure: isSecure,
            httpOnly: Number(r.httpOnly || 0) === 1,
          };
          if (r.expiresAt && r.expiresAt > 0) details.expirationDate = Math.floor(r.expiresAt / 1000);
          if (r.sameSite) details.sameSite = String(r.sameSite);
          try {
            await session.defaultSession.cookies.set(details);
          } catch {
            // ignore individual cookie errors
          }
        }
      }
    } catch {
      // ignore batch errors
    }
  }

  // Import (profiles detection, preview counts, run import)
  ipcMain.handle('import:detect-profiles', () => importer.detectProfiles());
  ipcMain.handle('import:preview', (_e: IpcMainInvokeEvent, profileId: string) => importer.preview(profileId));
  ipcMain.handle('import:run', async (_e: IpcMainInvokeEvent, profileId: string, opts?: ImportRunOptions) => {
    const res = await importer.run(profileId, opts);
    // If cookies were imported, apply them to Electron session so sites see the login state
    if ((opts?.cookies ?? false) && res.imported.cookies > 0) {
      await applyImportedCookiesToSession();
    }
    return res;
  });

  // Apply any previously imported cookies on startup so sites may see login state
  try { await applyImportedCookiesToSession(); } catch {}

  // Load renderer UI after handlers are ready
  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  try {
    if (!mainWindow.isVisible()) mainWindow.show();
  } catch {}

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single instance to avoid profile locks
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      try { mainWindow.show(); } catch {}
    }
  });
  app.commandLine.appendSwitch('ignore-gpu-blacklist');
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
  app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder');

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Tool Playground explicit nav:* handlers (tab isolation, default to active tab)
ipcMain.handle('nav:back', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string }) => {
  const targetTabId = tabId || activeTabId;
  const tab = targetTabId ? tabs.find(t => t.id === targetTabId) : undefined;
  if (tab && tab.view.webContents.canGoBack()) {
    await tab.view.webContents.goBack();
    // Wait for navigation to complete
    await new Promise(resolve => {
      const handler = () => {
        tab.view.webContents.removeListener('did-navigate', handler);
        resolve(undefined);
      };
      tab.view.webContents.once('did-navigate', handler);
      setTimeout(handler, 1200);
    });
    tab.url = tab.view.webContents.getURL();
    tab.title = await tab.view.webContents.getTitle();
    sendRenderer('tabs:updated', listTabs());
    // Only send tab:url-changed if this is the active tab
    if (tab.id === activeTabId) sendRenderer('tab:url-changed', tab.url);
    return { tabId: tab.id };
  }
  return { tabId: targetTabId, error: 'Cannot go back' };
});

ipcMain.handle('nav:forward', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string }) => {
  const targetTabId = tabId || activeTabId;
  const tab = targetTabId ? tabs.find(t => t.id === targetTabId) : undefined;
  if (tab && tab.view.webContents.canGoForward()) {
    await tab.view.webContents.goForward();
    await new Promise(resolve => {
      const handler = () => {
        tab.view.webContents.removeListener('did-navigate', handler);
        resolve(undefined);
      };
      tab.view.webContents.once('did-navigate', handler);
      setTimeout(handler, 1200);
    });
    tab.url = tab.view.webContents.getURL();
    tab.title = await tab.view.webContents.getTitle();
    sendRenderer('tabs:updated', listTabs());
    if (tab.id === activeTabId) sendRenderer('tab:url-changed', tab.url);
    return { tabId: tab.id };
  }
  return { tabId: targetTabId, error: 'Cannot go forward' };
});

ipcMain.handle('nav:reload', async (_e: IpcMainInvokeEvent, { tabId }: { tabId?: string }) => {
  const targetTabId = tabId || activeTabId;
  const tab = targetTabId ? tabs.find(t => t.id === targetTabId) : undefined;
  if (tab) {
    await tab.view.webContents.reload();
    await new Promise(resolve => {
      const handler = () => {
        tab.view.webContents.removeListener('did-navigate', handler);
        resolve(undefined);
      };
      tab.view.webContents.once('did-navigate', handler);
      setTimeout(handler, 1200);
    });
    tab.url = tab.view.webContents.getURL();
    tab.title = await tab.view.webContents.getTitle();
    sendRenderer('tabs:updated', listTabs());
    if (tab.id === activeTabId) sendRenderer('tab:url-changed', tab.url);
    return { tabId: tab.id };
  }
  return { tabId: targetTabId, error: 'Cannot reload' };
});

ipcMain.handle('nav:navigate', async (_e: IpcMainInvokeEvent, { tabId, url }: { tabId?: string, url: string }) => {
  const targetTabId = tabId || activeTabId;
  const tab = targetTabId ? tabs.find(t => t.id === targetTabId) : undefined;
  if (tab && url) {
    await tab.view.webContents.loadURL(url);
    tab.url = tab.view.webContents.getURL();
    tab.title = await tab.view.webContents.getTitle();
    sendRenderer('tabs:updated', listTabs());
    if (tab.id === activeTabId) sendRenderer('tab:url-changed', tab.url);
    return { tabId: tab.id, url };
  }
  return { tabId: targetTabId, url, error: 'Cannot navigate' };
});