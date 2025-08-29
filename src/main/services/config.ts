import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

export type AppConfig = {
  ai: {
    provider: 'ollama' | 'openai' | 'gemini';
    ollama: {
      host: string; // http://localhost:11434
      model: string; // e.g. llama3
    };
    openai?: {
      apiKey: string;
      host?: string; // default https://api.openai.com/v1
      model: string; // e.g. gpt-4o-mini
    };
    gemini?: {
      apiKey: string;
      host?: string; // default https://generativelanguage.googleapis.com
      model: string; // e.g. gemini-1.5-flash
    };
    instantSummaries: {
      enabled: boolean;
      autoOnLoad: boolean;
    };
  };
  search: {
    provider: 'auto' | 'searxng' | 'brave' | 'google' | 'bing' | 'presearch';
    priority?: Array<'searxng' | 'brave' | 'google' | 'bing' | 'presearch'>;
    brave: { apiKey: string };
    searxng: { baseUrl: string; engines?: string[]; categories?: string[] };
    google: { apiKey: string; cx: string };
    bing: { apiKey: string };
    presearch: { apiUrl?: string; apiKey?: string };
  };
  indexer: {
    enabled: boolean;
    historyFTS: boolean;
    documents: {
      enabled: boolean;
      directories: string[];
    };
    excludeGlobs: string[];
  };
  ui: {
    sidebar: { defaultOpen: boolean };
    compare: { mode: 'results-vs-ai' };
  };
  ranking?: {
    enabled?: boolean;
    activeProfile?: string;
    profilesDir?: string;
  };
  privacy?: {
    adBlocker?: 'enabled' | 'disabled';
  };
  onboarding?: {
    showImportOnFirstRun: boolean;
    importCompleted?: boolean;
  };
};

const DEFAULT_CONFIG: AppConfig = {
  ai: {
    provider: 'ollama',
    ollama: {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'deepseek-coder-v2:latest',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      host: process.env.OPENAI_HOST || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      host: process.env.GEMINI_HOST || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    instantSummaries: {
      enabled: true,
      autoOnLoad: false,
    },
  },
  search: {
    provider: (process.env.COMET_SEARCH_PROVIDER as any) || 'searxng',
    priority: (process.env.COMET_SEARCH_PRIORITY || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as any,
    brave: { apiKey: process.env.BRAVE_SEARCH_API_KEY || '' },
    searxng: {
      baseUrl: process.env.SEARXNG_BASE_URL || 'http://localhost:8080',
      engines: (process.env.SEARXNG_ENGINES || '').split(',').filter(Boolean),
      categories: (process.env.SEARXNG_CATEGORIES || '').split(',').filter(Boolean),
    },
    google: { apiKey: process.env.GOOGLE_SEARCH_API_KEY || '', cx: process.env.GOOGLE_SEARCH_CX || '' },
    bing: { apiKey: process.env.BING_SEARCH_API_KEY || '' },
    presearch: { apiUrl: process.env.PRESEARCH_API_URL || '', apiKey: process.env.PRESEARCH_API_KEY || '' },
  },
  indexer: {
    enabled: false,
    historyFTS: true,
    documents: {
      enabled: true,
      directories: [path.join(os.homedir(), 'Documents')],
    },
    excludeGlobs: ['**/.git/**'],
  },
  ui: {
    sidebar: { defaultOpen: true },
    compare: { mode: 'results-vs-ai' },
  },
  ranking: {
    enabled: false,
    activeProfile: 'default',
    profilesDir: path.join(os.homedir(), '.config', 'comet', 'ranking'),
  },
  privacy: { adBlocker: 'enabled' },
  onboarding: {
    showImportOnFirstRun: true,
    importCompleted: false,
  },
};

function getDefaultConfigPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Comet', 'config.yaml');
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Comet', 'config.yaml');
  }
  // linux and others
  return path.join(os.homedir(), '.config', 'comet', 'config.yaml');
}

export function loadConfig(): AppConfig {
  const cfgPath = process.env.COMET_CONFIG || getDefaultConfigPath();
  let loaded: Partial<AppConfig> = {};
  try {
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      const parsed = yaml.load(raw) as Partial<AppConfig>;
      loaded = parsed || {};
    }
  } catch (e) {
    // fall back to defaults on any error
  }
  // Migrate legacy ai.openai.baseUrl / ai.gemini.baseUrl to 'host' if present
  try {
    const anyLoaded = loaded as any;
    if (anyLoaded?.ai?.openai && !anyLoaded.ai.openai.host && anyLoaded.ai.openai.baseUrl) {
      anyLoaded.ai.openai.host = anyLoaded.ai.openai.baseUrl;
    }
    if (anyLoaded?.ai?.gemini && !anyLoaded.ai.gemini.host && anyLoaded.ai.gemini.baseUrl) {
      anyLoaded.ai.gemini.host = anyLoaded.ai.gemini.baseUrl;
    }
  } catch {}
  // shallow merge for top-level sections; nested defaults handle missing values
  const merged: AppConfig = {
    ...DEFAULT_CONFIG,
    ...loaded,
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...(loaded.ai || {}),
      ollama: { ...DEFAULT_CONFIG.ai.ollama, ...(loaded.ai?.ollama || {}) },
      openai: ({ ...DEFAULT_CONFIG.ai.openai, ...(loaded.ai?.openai || {}) } as NonNullable<AppConfig['ai']['openai']>),
      gemini: ({ ...DEFAULT_CONFIG.ai.gemini, ...(loaded.ai?.gemini || {}) } as NonNullable<AppConfig['ai']['gemini']>),
      instantSummaries: {
        ...DEFAULT_CONFIG.ai.instantSummaries,
        ...(loaded.ai?.instantSummaries || {}),
      },
    },
    search: {
      ...DEFAULT_CONFIG.search,
      ...(loaded.search || {}),
      brave: { ...DEFAULT_CONFIG.search.brave, ...(loaded.search?.brave || {}) },
      searxng: { ...DEFAULT_CONFIG.search.searxng, ...(loaded.search?.searxng || {}) },
      google: { ...DEFAULT_CONFIG.search.google, ...(loaded.search?.google || {}) },
      bing: { ...DEFAULT_CONFIG.search.bing, ...(loaded.search?.bing || {}) },
      presearch: { ...DEFAULT_CONFIG.search.presearch, ...(loaded.search?.presearch || {}) },
    },
    indexer: {
      ...DEFAULT_CONFIG.indexer,
      ...(loaded.indexer || {}),
      documents: {
        ...DEFAULT_CONFIG.indexer.documents,
        ...(loaded.indexer?.documents || {}),
      },
    },
    ui: {
      ...DEFAULT_CONFIG.ui,
      ...(loaded.ui || {}),
      sidebar: { ...DEFAULT_CONFIG.ui.sidebar, ...(loaded.ui?.sidebar || {}) },
      compare: { ...DEFAULT_CONFIG.ui.compare, ...(loaded.ui?.compare || {}) },
    },
    ranking: { ...DEFAULT_CONFIG.ranking, ...(loaded.ranking || {}) },
    privacy: { ...DEFAULT_CONFIG.privacy, ...(loaded.privacy || {}) },
    onboarding: { ...DEFAULT_CONFIG.onboarding!, ...(loaded.onboarding || {}) },
  };
  return merged;
}

export function ensureConfigDir(): string {
  const cfgPath = process.env.COMET_CONFIG || getDefaultConfigPath();
  const dir = path.dirname(cfgPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, yaml.dump(DEFAULT_CONFIG), 'utf-8');
  }
  return cfgPath;
}

export function saveConfig(cfg: AppConfig): void {
  const cfgPath = process.env.COMET_CONFIG || getDefaultConfigPath();
  try {
    const dir = path.dirname(cfgPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cfgPath, yaml.dump(cfg), 'utf-8');
  } catch (e) {
    // swallow errors; caller may ignore
  }
}
