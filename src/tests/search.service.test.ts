import { describe, it, expect } from 'vitest';
import { SearchService } from '../main/services/search';
import type { AppConfig } from '../main/services/config';

function baseConfig(): AppConfig {
  return {
    ai: {
      provider: 'ollama',
      ollama: { host: 'http://localhost:11434', model: 'llama3' },
      instantSummaries: { enabled: true, autoOnLoad: false },
    },
    search: {
      provider: 'auto',
      brave: { apiKey: '' },
      searxng: { baseUrl: 'http://localhost:8080', engines: [], categories: [] },
      google: { apiKey: '', cx: '' },
      bing: { apiKey: '' },
      presearch: { apiUrl: '', apiKey: '' },
    },
    indexer: {
      enabled: false,
      historyFTS: true,
      documents: { enabled: false, directories: [] },
      excludeGlobs: [],
    },
    ui: {
      sidebar: { defaultOpen: true },
      compare: { mode: 'results-vs-ai' },
    },
    ranking: { enabled: false, activeProfile: 'default', profilesDir: '' },
    privacy: { adBlocker: 'enabled' },
  };
}


describe('SearchService provider selection', () => {
  it('returns configured provider when not auto', () => {
    const cfg = baseConfig();
    cfg.search.provider = 'searxng';
    const svc = new SearchService(cfg);
    expect(svc.getProvider()).toBe('searxng');
  });

  it('auto prefers brave when api key present', () => {
    const cfg = baseConfig();
    cfg.search.provider = 'auto';
    cfg.search.brave.apiKey = 'abc123';
    const svc = new SearchService(cfg);
    expect(svc.getProvider()).toBe('brave');
  });

  it('auto picks searxng when available and no brave key', () => {
    const cfg = baseConfig();
    cfg.search.provider = 'auto';
    cfg.search.brave.apiKey = '';
    cfg.search.searxng.baseUrl = 'http://localhost:8080';
    const svc = new SearchService(cfg);
    expect(svc.getProvider()).toBe('searxng');
  });

  it('auto falls back to searxng when no providers are configured', () => {
    const cfg = baseConfig();
    cfg.search.provider = 'auto';
    cfg.search.brave.apiKey = '';
    cfg.search.searxng.baseUrl = '';
    cfg.search.google.apiKey = '';
    cfg.search.google.cx = '';
    cfg.search.bing.apiKey = '';
    cfg.search.presearch.apiUrl = '';
    const svc = new SearchService(cfg);
    expect(svc.getProvider()).toBe('searxng');
  });

  it('setProvider forces a specific provider', () => {
    const cfg = baseConfig();
    cfg.search.provider = 'auto';
    const svc = new SearchService(cfg);
    svc.setProvider('google');
    expect(svc.getProvider()).toBe('google');
  });

  it('setProvider("auto") defers to config/keys', () => {
    const cfg = baseConfig();
    cfg.search.provider = 'auto';
    cfg.search.brave.apiKey = 'key';
    const svc = new SearchService(cfg);
    svc.setProvider('auto');
    expect(svc.getProvider()).toBe('brave');
  });
});
