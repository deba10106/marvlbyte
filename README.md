# Comet (OSS)

Open-source AI-native browser built with Electron + React + TypeScript.

- Multi-provider web search with unified results (Brave, Google, Bing, SearxNG, Presearch)
- Local search (history + documents index)
- AI assistant (Ollama) for summarization and chat

## Requirements

- Node.js 18+
- npm 9+
- Docker (optional, for SearxNG quickstart)

## Install

```bash
npm install
```

## Develop

```bash
# Typecheck only
npm run typecheck

# Start Electron dev app (Forge + Webpack)
npm start
```

## Config

Default config path (Linux): `~/.config/comet/config.yaml`
Override with env: `COMET_CONFIG=/path/to/config.yaml`

Key sections:

```yaml
ai:
  provider: ollama  # or openai | gemini
  ollama:
    host: http://localhost:11434
    model: deepseek-coder-v2:latest
  openai:
    apiKey: "${OPENAI_API_KEY}"
    host: "${OPENAI_HOST}"   # optional; default https://api.openai.com/v1
    model: "${OPENAI_MODEL}"
  gemini:
    apiKey: "${GEMINI_API_KEY}"
    host: "${GEMINI_HOST}"   # optional; default https://generativelanguage.googleapis.com
    model: "${GEMINI_MODEL}"
  instantSummaries:
    enabled: true
    autoOnLoad: false

search:
  provider: searxng  # default; override via COMET_SEARCH_PROVIDER
  searxng:
    baseUrl: http://localhost:8080
  brave:
    apiKey: "${BRAVE_SEARCH_API_KEY}"
  google:
    apiKey: "${GOOGLE_SEARCH_API_KEY}"
    cx: "${GOOGLE_SEARCH_CX}"
  bing:
    apiKey: "${BING_SEARCH_API_KEY}"
  presearch:
    apiUrl: "${PRESEARCH_API_URL}"
    apiKey: "${PRESEARCH_API_KEY}"

indexer:
  enabled: false
  historyFTS: true
  documents:
    enabled: true
    directories:
      - ~/Documents
  excludeGlobs:
    - '**/.git/**'

ui:
  sidebar:
    defaultOpen: true
  compare:
    mode: results-vs-ai

privacy:
  adBlocker: enabled
```

Environment variables (override config):

- OPENAI_API_KEY, OPENAI_HOST (or OPENAI_BASE_URL), OPENAI_MODEL
- GEMINI_API_KEY, GEMINI_HOST (or GEMINI_BASE_URL), GEMINI_MODEL
- OLLAMA_HOST, OLLAMA_MODEL
- COMET_SEARCH_PROVIDER: auto | brave | searxng | google | bing | presearch
- BRAVE_SEARCH_API_KEY
- GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX
- BING_SEARCH_API_KEY
- SEARXNG_BASE_URL, SEARXNG_ENGINES, SEARXNG_CATEGORIES
- PRESEARCH_API_URL, PRESEARCH_API_KEY

## Local keyless providers (Docker)

SearxNG:
```bash
cd docker/searxng
# start
docker compose up -d
# stop
docker compose down
```


## Runtime provider switching

- The renderer uses `window.comet.searchWeb(query)`.
- Use the dropdown in the UI to switch providers at runtime.
- IPC: `search:get-provider` and `search:set-provider`.

## Tests (planned)

We use Vitest for unit tests. Install dev deps and run:

```bash
npm install -D vitest
npm run test
```

Test files live under `src/tests/**/*.test.ts`.

- `SearchService` provider selection is covered.
- IPC/e2e tests TBD.

## License

Apache-2.0
