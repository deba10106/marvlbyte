# Search providers

Comet supports multiple web search providers with a unified API:

- brave (API key)
- google (API key + CX)
- bing (API key)
- searxng (self-hosted, no key)
- presearch (experimental; requires custom JSON endpoint)

Default provider: __SearxNG__ (http://localhost:8080) unless overridden via `COMET_SEARCH_PROVIDER` or `search.provider` in config.

Config file location (Linux): `~/.config/comet/config.yaml`
You can override with `COMET_CONFIG` environment variable.

## Selecting a provider

In `search.provider`, choose one of: `auto | brave | searxng | google | bing | presearch`.

- `auto`: prefers Brave if `BRAVE_SEARCH_API_KEY` exists; otherwise SearxNG.

### Brave (default when key present)
```yaml
search:
  provider: brave
  brave:
    apiKey: "${BRAVE_SEARCH_API_KEY}"
```

### Google Custom Search
```yaml
search:
  provider: google
  google:
    apiKey: "${GOOGLE_SEARCH_API_KEY}"
    cx: "${GOOGLE_SEARCH_CX}"
```

### Bing Web Search
```yaml
search:
  provider: bing
  bing:
    apiKey: "${BING_SEARCH_API_KEY}"
```

### SearxNG (no API key)
Self-host or use a trusted instance. Recommended: run locally via Docker Compose below.
```yaml
search:
  provider: searxng
  searxng:
    baseUrl: "http://localhost:8080"
    engines: ["duckduckgo", "wikipedia"]  # optional
    categories: ["general"]                 # optional
```

Run locally:
```bash
cd docker/searxng
# start
docker compose up -d
# stop
docker compose down
```

### Presearch (experimental)
Presearch does not currently expose an official public JSON web search API. If you operate or proxy a compatible JSON endpoint, you can configure it:
```yaml
search:
  provider: presearch
  presearch:
    apiUrl: "http://your-endpoint/search"  # must return { results: [{ title, description|snippet, url|link }] }
    apiKey: ""  # optional bearer token if required by your endpoint
```
If you need keyless operation, prefer `searxng`.

## Environment variables

- COMET_SEARCH_PROVIDER: overrides `search.provider` (e.g., `searxng`)
- BRAVE_SEARCH_API_KEY
- GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX
- BING_SEARCH_API_KEY
- SEARXNG_BASE_URL, SEARXNG_ENGINES, SEARXNG_CATEGORIES
- PRESEARCH_API_URL, PRESEARCH_API_KEY

## Renderer API
No changes required. The renderer calls `window.comet.searchWeb(query)` and receives a unified
response: `{ results: [{ title, description, url }], query, summary, suggestions }`.
