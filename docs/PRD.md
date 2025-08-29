# Comet Browser — Product Requirements Document (PRD)

- Version: 1.0
- Last updated: 2025-08-30

## 1. Product Vision

The goal is to create a modern, fast, and secure web browser that is AI-native, integrating directly with popular large language models (LLMs) to enhance the user's browsing experience. The browser will focus on improving productivity and information discovery through conversational AI, all while prioritizing user privacy by utilizing decentralized search technology.

## 2. Core Features

### 2.1 AI Assistant Sidebar
- Persistent, collapsible sidebar on the right side of the browser window housing the primary AI functionality.
- Context-Aware Chat: Users can ask the AI assistant questions about the current web page content. The AI will have access to the page's text, images, and other metadata to provide relevant and accurate answers.
- Generative Actions: The AI can perform actions on the current page content, such as summarizing an article, extracting key points, translating text, or drafting an email reply based on the conversation history.
- Model Selection: A simple dropdown menu at the top of the sidebar allows users to select their preferred AI model from the configured options (OpenAI, Gemini, Ollama).

### 2.2 Search & Navigation
- Conversational Search: The unified address bar functions as a conversational search tool. Instead of displaying a traditional list of links, the browser will provide a conversational, AI-generated summary of search results. Users can then ask follow-up questions to refine the information.
- Decentralized Search Integration: The browser will use decentralized search engines' APIs (Brave Search, Presearch, Timpi) for all web search queries. Provider priority is configurable to avoid vendor lock-in and maximize independence.

### 2.3 User-Centric & Privacy Features
- Built-in Ad & Tracker Blocker: A native, non-optional feature that blocks ads and trackers to ensure a clean, fast, and private browsing experience out-of-the-box.
- Reading Mode: A button that strips a web page of all non-essential elements like ads, sidebars, and navigation, leaving only the primary content for a focused reading and AI analysis experience.
- Tab Sleeping: To prevent a high number of open tabs from slowing down the application, inactive background tabs will be "put to sleep," releasing system resources.

### 2.4 Browser Fundamentals
- Core Navigation: Standard back, forward, and refresh controls.
- Unified Address Bar: A single input for both URLs and search queries.
- Tab Management: Support for multiple tabs within a single window.
- Bookmarks & History: Save favorite sites and view a searchable browsing history.

### 2.5 AI-First Enhancements
- Instant Webpage Summaries (Local): One-click or auto-on-load summaries of the current page using a local Ollama model for privacy-preserving, offline operation. Cloud models can be used as fallback if configured.
- Side-by-Side Comparisons: Compare search results or AI responses from multiple providers/models (e.g., Brave vs Presearch; OpenAI vs Gemini vs Ollama) in a split view to aid evaluation and decision-making.
- Offline Search History & Private Indexing: Build an on-device, full-text searchable index of visited pages and optionally user-selected local documents. No external calls; all data remains local.
- Community-Powered Ranking Tweaks (Opt-in): Support importing community-contributed ranking profiles (YAML) to boost/demote domains or patterns. Disabled by default.

### 2.6 Comet-Parity Features (Planned)
- Voice Assistant (Push-to-Talk) — Planned: Converse by voice; read page aloud; on-device STT/TTS preferred with cloud fallback. Microphone and audio permissions surfaced clearly.
- @tab Cross-Tab Context — Planned: Mention `@tab` in prompts to include the content or metadata of selected open tabs so answers consider your current workspace.
- Agent Mode (Web Actions) — Planned: The assistant can (with consent) click, scroll, fill forms, follow links, and open new tabs to complete tasks. Actions run step-by-step with preview, per-step approval, and a visible overlay.
- Email & Calendar Integrations — Planned: Optional connectors (Gmail, Google Calendar) to summarize important emails, extract action items, and check availability. Disabled by default; least-privilege scopes; explicit write consent.
- Assistant-Driven Tab Management — Planned: Summarize all open tabs, deduplicate, group by topic, and propose closures. One-click apply with undo.
- Enterprise & Admin Controls — Planned: SSO/OIDC, policy controls (disable cloud AI, restrict actions, data residency), audit logs, and hardened sandboxing.

## 3. Configuration & Excluded Features

- Configuration:
  - YAML Configuration File: The primary method is a single, well-documented `config.yaml` stored in a user-specific application directory (Linux: `~/.config/comet/`, macOS: `~/Library/Application Support/Comet/`, Windows: `%APPDATA%/Comet/`).
  - Environment Variables: Critical settings may be provided via environment variables as secure overrides/fallbacks. No in-app UI for secrets.
  - Decentralized Providers: `search.providerPriority` allows ordering among Brave, Presearch, and Timpi.
  - AI Local Preference: `ai.instantSummaries.enabled` and `ai.instantSummaries.prefer` (default `ollama`) control instant summaries behavior.
  - Indexer: `indexer.enabled`, `indexer.historyFTS`, and `indexer.documents.directories` configure offline indexing of history and user documents.
  - Ranking Profiles: `ranking.activeProfile` and `ranking.profilesDir` configure community ranking tweaks (opt-in).
- Excluded Features: To maintain a lean, secure, and focused product, the browser will not include an extension store, a built-in password manager, or a cross-device syncing service.

## 4. Feature Spec — AI Assistant Sidebar

### 4.1 Overview and Purpose

The AI Assistant Sidebar is the central hub for the browser's key differentiating features. Its purpose is to provide a single, context-aware conversational interface for interacting with web content and performing generative tasks. It is designed to be a productivity tool that minimizes the need for users to switch between applications.

### 4.2 Detailed Requirements

#### 4.2.1 Core Functionality
- Persistent UI element on the right side of the browser, toggleable via keyboard shortcut.
- Contains a chat input field and a scrolling chat history view.
- A dropdown menu at the top allows the user to select from configured AI models (OpenAI, Gemini, Ollama).

#### 4.2.2 Contextual Awareness
- When a user sends a message, the AI is automatically provided with the text content of the currently active tab.
- The system uses a `preload.js` script to scrape text from common HTML elements (e.g., `<p>`, `<h1>`) to ensure a clean input for the AI.

#### 4.2.3 Generative Actions
- Summarize: Provide a concise summary of the current article.
- Explain: Break down complex topics or jargon from the page into simpler terms.
- Rewrite: Allow the user to select text on the page and command the AI to rewrite it for a different tone or style.

#### 4.2.4 Non-Functional Requirements
- Responsiveness: The sidebar must be responsive and not lag or freeze the main browser view during AI processing.
- Loading State: A clear loading indicator will be shown during an AI request to inform the user that a response is being generated.
- Error Handling: The UI will display a clear, user-friendly error message if an API call fails due to a network issue, invalid key, or API limit.

### 4.3 User Stories

- As a knowledge worker, I want to open the sidebar on a long report and ask the AI, "What are the three key findings?", so I can quickly extract the most important information.
- As a student, I want to copy a complex paragraph from a scientific paper and ask the AI to "Explain this to me like I'm 10," so I can understand difficult concepts without getting overwhelmed.
- As a writer, I want to select a few sentences on a blog post and tell the AI to "Rewrite this to be more professional," so I can use the content as a starting point for my own work.

## 5. Feature Spec — Agent Mode (Browser Automation)

### 5.1 Overview
- Agent Mode is an opt-in automation capability in the sidebar that plans and executes safe, auditable actions across one or more tabs to achieve user goals.
- Primary goals: autonomous navigation, web scraping/semantic extraction, multi-tab swarms, deliverables generation, workflow automation, real-time monitoring/alerts, secure credential handling, and agent swarm collaboration.

### 5.2 Scope & Non-Goals
- In scope: navigation, clicking, typing, selecting, scrolling, pagination, basic file downloads with approval, multi-tab orchestration, content extraction, export to Markdown/PDF/DOCX/PPTX, scheduled/triggered runs, MCP tool integrations, and alerting.
- Out of scope: unrestricted OS automation, arbitrary file system writes, background actions without clear consent, credential exfiltration, and extensions marketplace.

### 5.3 Personas & Key User Stories
- Research Analyst: “Open top 5 results, extract KPIs/tables, and generate a 10‑slide briefing (with sources).”
- Financial Analyst: “Track competitor filings weekly, summarize changes, and export to DOCX for my team.”
- Growth PM: “Scrape pricing pages, compare plans, and alert me on changes.”
- QA Engineer: “Run scripted flows across staging/prod, capture screenshots, and file a Markdown report.”

### 5.4 Capabilities & Prioritization
- MVP (P0):
  - Autonomous navigation with per-step approval overlay
  - DOM actions: click, type, select, scroll, follow link, waitFor selector/text
  - Content extraction via preload (text, tables, lists); Readability mode fallback
  - Multi-tab open/switch/close; bounded tab swarm (up to N)
  - Deliverables pipeline: Markdown report with citations; export to PDF
  - Guardrails: domain scoping, rate limits/timeouts, global kill switch, audit log
  - Secure credentials: encrypted vault; per-use consent (no autofill)

- Phase 2 (P1):
  - Pagination handling (next/prev/infinite scroll) and table scraping helpers
  - Workflow automation: saved tasks, scheduled runs, on-demand re-run
  - MCP tool integrations (e.g., GitHub, Notion, Google Drive exporters)
  - Real-time monitors: page diffing, price/change alerts (sidebar + system notification)
  - Deliverables: DOCX and PPTX exports with templates

- Phase 3 (P2):
  - Agent swarms: parallel tab teams with role prompts (Researcher, Extractor, Writer)
  - Collaboration: share tasks and results (export/import JSON), reproducible runs
  - Rich scraping: screenshot-to-text OCR helper, semantic extraction schemas (Zod)
  - Advanced approvals: trust domains with auto-advance windows

### 5.5 UX & Controls
- Sidebar “Agent” tab with:
  - Plan preview pane (steps with selectors, target URLs, and notes)
  - Live run console (per-step logs, DOM highlights, data previews)
  - Approvals: step-by-step confirm; optional auto-advance for trusted domains
  - Status: progress bar, ETA, kill/pause/resume, and errors with retry
- Results view: extract tables to CSV/Markdown, copy to clipboard, export via deliverables pipeline

### 5.6 Security, Privacy, and Safety
- Strict content/selector sandbox via preload; no arbitrary eval; IPC allowlist
- Domain scoping (same-origin default); cross-domain requires explicit consent per run
- No credential autofill; per-use token retrieval from encrypted vault; least privilege
- Guardrails: rate limits, timeouts, and action caps; end-to-end audit log of actions/results
- Prompt-injection hardening by separating user instructions from page content

### 5.7 Acceptance Criteria (MVP)
- Plan preview shows at least 5 common actions and requires user approval per step
- Agent can navigate, click, type, scroll, follow link, and waitFor selectors reliably on 3 major sites
- Extraction returns structured text and tables; Markdown report with citations exports to PDF
- Multi-tab swarm opens up to N tabs and aggregates results deterministically
- All actions logged with timestamp, URL, selector, and outcome; kill switch stops within 1s
- Credentials (if configured) are stored encrypted and require per-use consent
- Core bounded actions are exposed as tools (e.g., `browser.*`, `extract.*`, `deliverables.*`); each call is audit-logged with inputs/outputs and approvals.

### 5.8 KPIs
- Task success rate, average steps per task, median time to completion
- Error rate (selector misses/timeouts), user overrides/aborts, deliverable exports/week

### 5.9 Tool Surface (Agents as Tools)
- Philosophy: bounded operations are exposed as tools for safety, auditability, and composability. Only planners/schedulers remain agents/services.
- Tools (examples):
  - Browser/DOM: `browser.navigate`, `browser.openTab`, `browser.closeTab`, `browser.back`, `browser.forward`, `browser.scroll`, `browser.click`, `browser.type`, `browser.select`, `browser.waitFor`, `browser.screenshot`, `browser.getHtml`
  - Extraction/Selectors: `extract.text`, `extract.table`, `extract.list`, `extract.metadata`, `selector.find`
  - Search: `search.brave`, `search.presearch`, `search.timpi`
  - Deliverables: `deliverables.markdownToPdf`, `deliverables.markdownToDocx`, `deliverables.outlineToPptx`
  - Data Ops: `data.dedupe`, `data.cluster`, `data.summarize`
  - Credentials: `credentials.getSecret`, `credentials.signRequest` (with per-use consent)
  - Monitoring Mgmt: `monitor.create`, `monitor.update`, `monitor.delete`, `monitor.list`, `monitor.runOnce`
  - Connectors (via MCP): `notion.createPage`, `sheets.appendRows`, `slack.postMessage`, `github.createIssue`, `webhook.send`, `email.send`
  - Artifacts/Storage: `artifact.write`, `artifact.read`, `artifact.list`
- Keep as Agents/Services: `AgentOrchestrator` (planner/approvals), `SwarmCoordinator` (multi-tab), `MonitorService` (scheduler/worker), Guardrails/RateLimiter & Audit Logger.

## 6. Feature Spec — Voice Assistant (Planned)

### 6.1 Overview
- Push-to-talk microphone capture with live transcription; TTS to read answers and page summaries.

### 6.2 Requirements
- Local-first STT/TTS with cloud fallback; configurable in `config.yaml`.
- Voice sessions are transient; transcripts stored only if user saves.

### 6.3 User Stories
- As a commuter, I want to ask, “What’s this article about?” and hear a short summary.
- As a power user, I want to dictate a query while referencing `@tab 3` for context.

## 7. Feature Spec — Email & Calendar Integrations (Planned)

### 7.1 Overview
- Optional connectors for Gmail and Google Calendar to summarize important messages, extract action items, and check availability windows.

### 7.2 Privacy & Consent
- Disabled by default; least-privilege read scopes by default; per-write confirmation (e.g., creating events or drafts).
- Tokens stored encrypted locally; revocation flow in Settings.

### 7.3 User Stories
- As a manager, I want a morning summary of priority emails and calendar conflicts.
- As an individual contributor, I want the assistant to propose meeting times based on my calendar when emailing external partners (draft only, confirm before sending).
