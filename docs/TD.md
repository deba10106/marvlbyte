# Comet Browser — Technical Design (TD)

- Version: 1.0
- Last updated: 2025-08-28

## 1. Technology Stack & Architecture

- Framework: Electron
- Core Language: TypeScript
- UI Library: React + shadcn/ui (Tailwind CSS)
- State Management: Redux Toolkit
- Build Tools: Electron Forge
- External Libraries: Brave Search API (HTTP), Node.js `fs` module, `js-yaml`, `Readability.js`, `better-sqlite3` (SQLite), `chokidar` (file watching)

### 1.1 High-Level Architecture

- Main Process (Electron):
  - Manages app lifecycle, windows, and tabs via `BrowserView`.
  - Hosts secure IPC endpoints for renderer communication (contextIsolation on; no Node integration in renderer).
  - Contains `configManager` (loads `config.yaml` and env), `AiService` (provider-agnostic LLM interface), ad/tracker blocker, tab sleeping scheduler, `BookmarksService`, `HistoryService` (SQLite-backed), and `IndexerService` (local file indexing).
- Renderer (React + Redux):
  - Renders the chrome (address bar with conversational search, tabs), main content area, and AI Assistant Sidebar.
  - Dispatches user intents to main via IPC and updates UI state from replies.
- Preload Scripts:
  - A `preload.js` is attached to each `BrowserView` to provide safe, read-only access to page content for extraction and to bridge minimal, audited IPC to the main process.

### 1.2 Data Flows

- Context-Aware Chat (Sidebar):
  1) User enters a prompt in the sidebar (renderer).
  2) Renderer requests current tab content (via preload → IPC → main).
  3) Main invokes `AiService` with the selected model, prompt, and context.
  4) `AiService` calls the external model API (OpenAI/Gemini/Ollama), handles responses/streams.
  5) Main returns the AI response via IPC; renderer updates chat.

- Conversational Search (Address Bar):
  1) User enters a query in the address bar.
  2) Main sends the query to Brave Search API, obtains search results (title, description, url).
  3) Main calls `AiService` to produce an AI-generated summary and suggested next questions.
  4) Renderer displays the summary and enables follow-up queries.

- Bookmarks:
  1) User clicks the star icon or uses a shortcut (e.g., Ctrl/Cmd+D) in the renderer.
  2) Renderer sends `bookmarks:add` (title, url, optional tags) via IPC to main.
  3) Main `BookmarksService` persists record to SQLite; returns created bookmark to renderer.
  4) Renderer updates local state and UI; star reflects saved state.
  - List/Remove/Toggle follow the same IPC pattern (`bookmarks:list`, `bookmarks:remove`, `bookmarks:toggle`).

- History:
  1) On navigation committed/completed, main listens to `webContents` events and extracts (url, title, timestamp).
  2) `HistoryService` upserts visit entry in SQLite (increments `visitCount`).
  3) Renderer can request history (`history:list`, with paging/filter) for a history panel.
  4) Address bar suggestions query `history:suggest` (prefix/FTS if available) for recent/most-visited matches.

- Address Bar Suggestions:
  1) Renderer debounces keystrokes and issues `omnibox:suggest` to main.
  2) Main aggregates suggestions from Bookmarks and History and returns ranked candidates.
  3) Renderer renders dropdown; selecting an item navigates the active tab.

- Instant Webpage Summaries (Local First):
  1) On page load complete, renderer requests content via preload → IPC → main.
  2) Main calls `AiService` (Ollama) when `ai.instantSummaries.enabled` is true.
  3) Response cached by (url, contentHash, model) to avoid recomputation.
  4) Renderer displays a summary chip in the toolbar/sidebar; user can expand for details.

- Side-by-Side Comparisons:
  1) User activates Compare mode in the UI and selects providers/models.
  2) Main orchestrates parallel calls (Promise.all) to selected providers/models with identical prompts.
  3) Results are normalized and streamed back to renderer as separate panes for direct comparison.
  4) Renderer supports copy/export and follow-up prompts per pane.

- Offline Private Indexing (History & Documents):
  1) History: On navigation events, `HistoryService` stores page text (extracted via preload) into `history` and `history_fts`.
  2) Documents: If enabled, `IndexerService` watches configured folders using `chokidar`; extracts text and updates `documents` and `documents_fts`.
  3) Local Search: Renderer issues `search:local` IPC; main performs FTS query and returns results.

- Voice Assistant (Planned):
  1) User holds push-to-talk in the sidebar.
  2) Renderer captures audio, streams to `VoiceService` in main via IPC.
  3) `VoiceService` performs STT (local first; cloud fallback) and forwards text to `AiService` with optional `@tab` references.
  4) `AiService` streams answer; TTS optionally reads response and/or page summary back to the user.

- @tab Cross-Tab Context (Planned):
  1) Renderer parses mentions like `@tab 2`, `@tab:all`, or title-matched `@tab:"Docs"`.
  2) For each referenced tab, preload extracts sanitized text and metadata; main aggregates into a bounded context package.
  3) `AiService` receives user prompt + structured tab contexts; prompts include tab titles and short content excerpts with IDs.

- Agentic Assistant Actions (Planned):
  1) User requests a task; `AgentOrchestrator` proposes a step plan (navigate/click/fill/scroll/newTab).
  2) UI shows a step-by-step preview overlay; user approves each step (or toggles auto-advance within safe domains).
  3) `ActionRunner` executes DOM actions in the active `BrowserView` via a constrained IPC API exposed by preload.
  4) Results (DOM snapshots/text) stream back to the model to determine next steps until done/aborted.

- Email & Calendar Connectors (Planned):
  1) User opts in and completes OAuth in a separate system browser window.
  2) Tokens stored locally (encrypted) by `ConnectorService`.
  3) Assistant queries summaries (labels, threads, upcoming events) with least-privilege scopes; write operations (drafts/events) require explicit per-action confirmation.

### 1.3 Security & Privacy

- Secrets are never entered via UI; loaded from `config.yaml` and environment variables.
- IPC channels are whitelisted and validated; no arbitrary eval; content scripts run with strict CSP.
- Decentralized search (Brave) used by default to align with privacy-first goals.

- Agentic Safety (Planned):
  - Separate user instructions from page content to mitigate indirect prompt injection (see Brave research on Comet).
  - Per-step user approval UI; global kill switch; visible action overlay.
  - Domain scoping (actions limited to originating domain unless approved), rate limits, and timeouts.
  - No credential autofill, file downloads, or clipboard writes without explicit confirmation.
  - Action allowlist (navigate, click, type, select, scroll, open tab) with constrained selectors.

### 1.4 Default Paths & Storage

- Configuration file (`config.yaml`) default locations:
  - Linux: `~/.config/comet/config.yaml`
  - macOS: `~/Library/Application Support/Comet/config.yaml`
  - Windows: `%APPDATA%/Comet/config.yaml`
- Local database: SQLite file stored alongside config (e.g., `comet.db`) containing tables:
  - `bookmarks(id, title, url, createdAt, tags?)`
  - `history(id, url, title, visitAt, visitCount)`
  - `documents(id, path, title, content, indexedAt, size, mime)`
  - FTS5 virtual tables: `history_fts(content)` and `documents_fts(content)` with triggers to keep in sync

## 2. Implementation Plan & Workflow

- Phase 1: Foundation
  - Initialize Electron + React + TypeScript scaffolding with Electron Forge.
  - Configure secure IPC between main and renderer (contextIsolation, preload pattern).

- Phase 2: Core Browser Functionality
  - Implement navigation (back, forward, refresh) and unified address bar.
  - Implement tab management using `BrowserView` (create, activate, close).

- Phase 3: AI Integration
  - Implement `AiService` providing a single API for OpenAI, Gemini, and Ollama.
  - Implement `configManager` for securely loading/storing API keys and options.

- Phase 4: AI-Native & Search Features
  - Content Extraction: inject `preload.js` into every `BrowserView` to extract text.
  - Conversational Search: detect queries in the address bar; query Brave Search; summarize via selected AI model.
  - Instant Summaries: implement local-first summaries using Ollama.
  - Side-by-Side Comparisons: implement parallel provider/model calls for direct comparison.

- Phase 5: Polish & Distribution
  - Finalize UI/UX, implement ad & tracker blocker and Reading Mode.
  - Package the application with Electron Forge for all target platforms.

- Phase 6: Voice & Cross-Tab Context (Planned)
  - Implement `VoiceService` (STT/TTS adapters), push-to-talk UI, and `@tab` context packaging.

- Phase 7: Agentic Assistant & Connectors (Planned)
  - Implement `AgentOrchestrator`, `ActionRunner`, approval overlays, guardrails.
  - Add Gmail/Calendar connectors (read-first; gated write flows).

## 3. Components

- AiService
  - Provider-agnostic interface for chat/completions across OpenAI, Gemini, and Ollama (stream handling for Ollama).
- ConfigManager
  - Loads `config.yaml` via `js-yaml`; merges with env vars for secrets (e.g., `OPENAI_API_KEY`).
- Content Extraction (preload.js)
  - Scrapes readable text from common elements (`<p>`, headings, lists) and sanitizes it for AI input.
- Conversational Search
  - Orchestrates Brave Search API calls and AI summarization; feeds results to UI.
- Ad & Tracker Blocker
  - Native, non-optional blocker wired into Electron networking; improves privacy and performance.
- Reading Mode
  - Uses `Readability.js` to derive main article content; toggled in UI for focused reading and better AI context.
- Tab Sleeping
  - Detects inactive tabs; suspends expensive resources to reduce memory/CPU usage.
- BookmarksService (Main)
  - SQLite-backed CRUD for bookmarks; exposes IPC: `bookmarks:add`, `bookmarks:list`, `bookmarks:remove`, `bookmarks:toggle`.
  - Ensures uniqueness by URL; supports optional tags; returns canonical records.
- HistoryService (Main)
  - Records visits on navigation; schema with `(url, title, visitAt, visitCount)`; provides IPC: `history:list`, `history:suggest`.
  - Supports SQLite FTS5 for fast suggestions where available; gracefully degrades to LIKE queries.
- Address Bar (Omnibox)
  - Renderer component that merges AI query mode with URL navigation; consumes suggestions from main.
- IndexerService (Main)
  - Watches configured directories (if enabled) using `chokidar`; extracts text (Readability.js for HTML, plain text for others), normalizes and stores into `documents` + `documents_fts`.
  - Provides IPC: `indexer:rescan`, `indexer:status`, and serves `search:local` queries.
- Compare Orchestrator & CompareView
  - Runs parallel provider/model calls with aligned prompts; normalizes and streams into split UI panes; caches by query/model/provider.

- VoiceService (Planned)
  - STT adapters: Vosk/Whisper (local), Google/Deepgram (cloud). TTS adapters: eSpeak/Coqui (local), ElevenLabs/Cloud.
  - Handles audio capture IPC, streaming transcription, and response synthesis playback.

- TabContextService (Planned)
  - Maintains metadata for open tabs; orchestrates content extraction for `@tab` references with size limits and deduplication.

- AgentOrchestrator & ActionRunner (Planned)
  - Converts model intents into an approved action plan; executes DOM-safe actions via preload bridge; collects results for iterative planning.
  - Enforces guardrails: allowlist, scoping, rate limiting, and confirmations.

- ConnectorService (Planned)
  - OAuth token storage (encrypted). Gmail/Calendar adapters with least-privilege scopes.
  - Exposes summarize/list APIs; write flows require explicit per-action approval.

## 4. Quality Assurance (QA)

- Unit Testing: Jest for reducers/helpers/services, including `BookmarksService`, `HistoryService`, `IndexerService`, ranking application, and compare orchestration.
- Integration Testing: Validate IPC for `bookmarks:*`, `history:*`, `search:local`, `indexer:*`, `omnibox:suggest`, and compare orchestration.
- End-to-End (E2E) Testing: Playwright flows – instant summaries (local-first with Ollama), side-by-side comparisons, add/remove bookmark with persistence, history recording, omnibox suggestions, conversational search, sidebar actions.
- Migration/Resilience: Verify SQLite schema migrations (no data loss) and corruption handling (auto-rebuild with backup). Validate FTS availability and degrade gracefully.
- Privacy: Assert no network calls when configured for local-only operation (Ollama + local indexer), including tests with network intercepts.

## 5. API Integrations (AiService)

### 5.1 OpenAI
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Authentication: Bearer Token (`Authorization: Bearer <OPENAI_API_KEY>`)
- Host override: configurable via `ai.openai.host` or `OPENAI_HOST` (falls back to `OPENAI_BASE_URL` for compatibility)
- Request Body (example):
```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Summarize this page:"}
  ]
}
```
- Response Body: Message object with the AI's generated content.

### 5.2 Google Gemini
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
- Authentication: API Key in URL query parameter (`?key=<GEMINI_API_KEY>`)
- Host override: configurable via `ai.gemini.host` or `GEMINI_HOST` (falls back to `GEMINI_BASE_URL` for compatibility)
- Request Body (example):
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {"text": "Summarize this page:"}
      ]
    }
  ]
}
```
- Response Body: Content object with generated text.

### 5.3 Ollama (Local)
- Endpoint: `http://localhost:11434/api/chat`
- Authentication: None (local service)
- Request Body (example):
```json
{
  "model": "llama3",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Summarize this page:"}
  ]
}
```
- Response Body: Streamed chunks that must be assembled into a final response (AiService handles stream assembly and error propagation).

### 5.4 Brave Search (Decentralized Search)
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Authentication: `X-Subscription-Token: <BRAVE_SEARCH_API_KEY>` header
- Request: `GET /res/v1/web/search?q=your_query`
- Response Body: JSON with `web.results[]` where each result has `title`, `description`, and `url`. AiService parses and forwards salient context to the selected AI model for summarization.

### 5.5 Decentralized Search Providers (Adapters: Presearch, Timpi)
- Providers: Presearch and Timpi are supported via a pluggable adapter interface.
- Authentication: Provider-specific (commonly API key in header or query). Some local nodes may require no auth.
- Endpoints: Configured via `config.yaml` (see `search.providers.*.baseUrl`).
- Request: GET with query parameter (e.g., `q=...`). Additional params are adapter-specific and configurable.
- Response Normalization: Each adapter returns a unified structure: `{ title, description, url }[]` to the caller.

### 5.6 Google Gmail (Planned)
- OAuth 2.0 (installed app). Scopes: read-only by default; incremental for drafts/sending with consent.
- Endpoints: Gmail REST (threads, messages with metadata). Summarization runs locally or via configured AI.

### 5.7 Google Calendar (Planned)
- OAuth 2.0. Scopes: read-only default; event create/edit gated by explicit confirmation per action.
- Endpoints: Calendar REST (events list, free/busy).

### 5.8 Speech (STT/TTS) (Planned)
- STT providers: local (Vosk/Whisper) and cloud (Google/Deepgram). TTS providers: local (eSpeak/Coqui) and cloud (ElevenLabs/Cloud TTS).
- All providers are optional and configured via `config.yaml`.

## 6. Configuration

- All configuration is file- and env-based. No UI for secrets.
- Primary file: `config.yaml` (values can reference environment variables).

Example `config.yaml` structure:
```yaml
ai:
  provider: openai
  openai:
    apiKey: ${OPENAI_API_KEY}
    host: ${OPENAI_HOST}  # optional; default https://api.openai.com/v1
    model: gpt-4o
  gemini:
    apiKey: ${GEMINI_API_KEY}
    host: ${GEMINI_HOST}  # optional; default https://generativelanguage.googleapis.com
    model: gemini-pro
  ollama:
    host: http://localhost:11434
    model: llama3
  instantSummaries:
    enabled: true
    prefer: ollama
    autoOnLoad: false
  voice:  # Planned
    enabled: false
    stt:
      provider: local  # local|google|deepgram
      model: whisper-small
    tts:
      provider: local  # local|elevenlabs|cloud
      voice: default

search:
  providerPriority:
    - brave
    - presearch
    - timpi
  providers:
  brave:
    apiKey: ${BRAVE_SEARCH_API_KEY}
    presearch:
      apiKey: ${PRESEARCH_API_KEY}
      baseUrl: ${PRESEARCH_API_URL}
    timpi:
      apiKey: ${TIMPI_API_KEY}
      baseUrl: ${TIMPI_API_URL}

indexer:
  enabled: true
  historyFTS: true
  documents:
    enabled: true
    directories:
      - ~/Documents
  excludeGlobs:
    - "**/.git/**"

agent:  # Planned
  enabled: false
  actions:
    domainScope: same-origin
    allowAutoAdvance: false
    maxSteps: 10

connectors:  # Planned
  gmail:
    enabled: false
    clientId: ${GMAIL_CLIENT_ID}
    clientSecret: ${GMAIL_CLIENT_SECRET}
  gcal:
    enabled: false
    clientId: ${GCAL_CLIENT_ID}
    clientSecret: ${GCAL_CLIENT_SECRET}

ranking:
  enabled: false
  activeProfile: default
  profilesDir: ~/.config/comet/ranking/

ui:
  sidebar:
    defaultOpen: true
  compare:
    layout: side-by-side
    defaultProviders:
      - brave
      - presearch
    defaultModels:
      - ollama:llama3
      - openai:gpt-4o

privacy:
  adBlocker: enabled
```

## 7. Build & Distribution

- Electron Forge configuration for packaging and code signing as required by platforms.
- CI to lint, test, and produce distributables for macOS, Windows, and Linux.
