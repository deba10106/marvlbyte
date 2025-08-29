import axios from 'axios';
import type { AppConfig } from './config';
import type { AiService } from './ai';

export type BraveResult = { title: string; description: string; url: string };
export type BraveSearchResponse = { results: BraveResult[]; query: string; summary?: string; suggestions?: string[] };

export class SearchService {
  private cfg: AppConfig;
  private ai: AiService;
  private overrideProvider?: AppConfig['search']['provider'];

  constructor(cfg: AppConfig, ai: AiService) {
    this.cfg = cfg;
    this.ai = ai;
  }

  private pickProvider(): AppConfig['search']['provider'] {
    const o = this.overrideProvider;
    if (o && o !== 'auto') return o;
    const p = this.cfg.search.provider as any;
    const allowed: AppConfig['search']['provider'][] = ['brave', 'searxng', 'google', 'bing', 'presearch'];
    if (p && p !== 'auto' && (allowed as any).includes(p)) return p as AppConfig['search']['provider'];

    const isConfigured = (prov: AppConfig['search']['provider']) => {
      if (prov === 'brave') return !!this.cfg.search.brave?.apiKey;
      if (prov === 'searxng') return !!this.cfg.search.searxng?.baseUrl;
      if (prov === 'google') return !!(this.cfg.search.google?.apiKey && this.cfg.search.google?.cx);
      if (prov === 'bing') return !!this.cfg.search.bing?.apiKey;
      if (prov === 'presearch') return !!this.cfg.search.presearch?.apiUrl;
      return false;
    };

    // Honor configured priority list if provided
    const priority = this.cfg.search.priority || [];
    for (const prov of priority) {
      if (isConfigured(prov as any)) return prov as any;
    }

    // Fallback to a sensible order based on available config
    const ordered: AppConfig['search']['provider'][] = ['brave', 'searxng', 'google', 'bing', 'presearch'];
    for (const prov of ordered) {
      if (isConfigured(prov)) return prov;
    }

    // Final fallback
    return 'searxng';
  }

  setProvider(p: AppConfig['search']['provider']) {
    this.overrideProvider = p;
  }

  getProvider(): AppConfig['search']['provider'] {
    return this.pickProvider();
  }

  async searchWeb(query: string, options?: { skipSummary?: boolean }): Promise<BraveSearchResponse> {
    const provider = this.pickProvider();
    let results: BraveResult[] = [];

    if (provider === 'brave') results = await this.searchBrave(query);
    else if (provider === 'searxng') results = await this.searchSearxng(query);
    else if (provider === 'google') results = await this.searchGoogle(query);
    else if (provider === 'bing') results = await this.searchBing(query);
    else if (provider === 'presearch') results = await this.searchPresearch(query);
    else throw new Error(`Unsupported provider: ${provider}`);

    let summary = '';
    if (results.length && !options?.skipSummary) {
      const lines = results.slice(0, 8).map((r, i) => `${i + 1}. ${r.title} — ${r.description}\n${r.url}`);
      const prompt: string = `Given the following web search results for "${query}", provide a concise, neutral summary (4-6 sentences) and list 3 suggested follow-up questions.\n\nResults:\n${lines.join('\n\n')}`;
      summary = await this.ai.chat([
        { role: 'system', content: 'You summarize web search results succinctly and accurately.' },
        { role: 'user', content: prompt },
      ]);
    }

    const suggestions = (summary.match(/(?:^|\n)\s*(?:-\s+|\d+\.\s+)(.+)/g) || [])
      .map((s) => s.replace(/(?:^|\n)\s*(?:-\s+|\d+\.\s+)/, '').trim())
      .slice(0, 5);

    return { results, query, summary, suggestions };
  }

  private async searchBrave(query: string): Promise<BraveResult[]> {
    const apiKey = this.cfg.search.brave.apiKey;
    if (!apiKey) throw new Error('Brave Search API key missing. Set BRAVE_SEARCH_API_KEY or search.brave.apiKey in config.yaml');
    const url = 'https://api.search.brave.com/res/v1/web/search';
    const resp = await axios.get(url, {
      params: { q: query },
      headers: { 'X-Subscription-Token': apiKey },
      timeout: 20000,
    });
    const data = resp.data as any;
    return (data?.web?.results || []).map((r: any) => ({ title: r.title, description: r.description, url: r.url }));
  }

  private async searchSearxng(query: string): Promise<BraveResult[]> {
    const base = (this.cfg.search.searxng?.baseUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('SearxNG baseUrl not configured. Set search.searxng.baseUrl (e.g., http://localhost:8080).');
    const params: any = { q: query, format: 'json' };
    const engines = this.cfg.search.searxng?.engines;
    const cats = this.cfg.search.searxng?.categories;
    if (engines && engines.length) params.engines = engines.join(',');
    if (cats && cats.length) params.categories = cats.join(',');
    // Some SearxNG instances return 403 for non-browser UAs or missing Referer
    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Comet/0.1 Safari/537.36',
      'Referer': `${base}/`,
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    try {
      const resp = await axios.get(`${base}/search`, { params, timeout: 20000, headers });
      const data = resp.data as any;
      const arr: any[] = Array.isArray(data?.results) ? data.results : [];
      return arr.map((r: any) => ({ title: r.title, description: r.content || r.pretty_url || '', url: r.url }));
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 403) {
          throw new Error(
            'SearxNG returned 403 Forbidden. Ensure JSON output is enabled in your SearxNG settings.yml:\n' +
              'search:\n  formats:\n    - html\n    - json\n' +
              'If using Docker, mount settings.yml to /etc/searxng/settings.yml and restart the container.'
          );
        }
        const detail = typeof err.response?.data === 'string' ? err.response?.data : JSON.stringify(err.response?.data || {});
        throw new Error(`SearxNG request failed: HTTP ${status || 'ERR'} ${detail}`);
      }
      throw err;
    }
  }

  private async searchGoogle(query: string): Promise<BraveResult[]> {
    const { apiKey, cx } = this.cfg.search.google || { apiKey: '', cx: '' };
    if (!apiKey || !cx) throw new Error('Google Custom Search requires apiKey and cx. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX.');
    const resp = await axios.get('https://www.googleapis.com/customsearch/v1', { params: { key: apiKey, cx, q: query }, timeout: 20000 });
    const data = resp.data as any;
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    return items.map((r: any) => ({ title: r.title, description: r.snippet, url: r.link }));
  }

  private async searchBing(query: string): Promise<BraveResult[]> {
    const apiKey = this.cfg.search.bing?.apiKey || '';
    if (!apiKey) throw new Error('Bing Web Search requires apiKey. Set BING_SEARCH_API_KEY.');
    const resp = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      params: { q: query, textDecorations: false, textFormat: 'Raw' },
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      timeout: 20000,
    });
    const data = resp.data as any;
    const items: any[] = Array.isArray(data?.webPages?.value) ? data.webPages.value : [];
    return items.map((r: any) => ({ title: r.name, description: r.snippet, url: r.url }));
  }

  private async searchPresearch(query: string): Promise<BraveResult[]> {
    const apiUrl = (this.cfg.search.presearch?.apiUrl || '').replace(/\/$/, '');
    if (!apiUrl) throw new Error('Presearch API URL not configured. Set search.presearch.apiUrl to a compatible endpoint.');
    const headers: any = {};
    const key = this.cfg.search.presearch?.apiKey;
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const resp = await axios.get(`${apiUrl}`, { params: { q: query }, headers, timeout: 20000 });
    const data = resp.data as any;
    const arr: any[] = Array.isArray(data?.results) ? data.results : [];
    return arr.map((r: any) => ({ title: r.title || '', description: r.description || r.snippet || '', url: r.url || r.link }));
  }
}
