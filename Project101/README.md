# Git Dashboard

A codebase analysis dashboard for legacy repositories. It renders the most load-bearing part of a repository as an interactive module graph — sized and colored by cyclomatic complexity — and pairs it with a blame-aware chat assistant, human-readable legacy-code explanations, a refactor history timeline, and a side-by-side refactor sandbox built on Monaco.

The app runs against a **local FastAPI analysis engine** ([`backend/`](backend/)) that shells out to `git` (log, blame, numstat) and runs radon complexity metrics over a target repository, serving live topology, per-file history, and blame-grounded chat replies at `http://localhost:8000`. The UI will not show data unless the backend is running — see [Getting started](#getting-started).

> **Note:** an earlier prototype of this app ran entirely on a deterministic, seeded mock data engine. Those modules are still in the tree under [`src/data/`](src/data/) but are **no longer imported by any live code path** — the sections below that describe them are retained as documentation of that prototype.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Design system](#design-system)
- [Core features](#core-features)
  - [1. Module graph](#1-module-graph)
  - [2. File side panel](#2-file-side-panel)
  - [3. Blame assistant (contextual chat)](#3-blame-assistant-contextual-chat)
  - [4. Refactor Sandbox](#4-refactor-sandbox)
  - [5. Impact analysis](#5-impact-analysis)
- [Mock data engine](#mock-data-engine)
- [State management](#state-management)
- [Data model reference](#data-model-reference)
- [Search grammar](#search-grammar)
- [Styling conventions](#styling-conventions)
- [Known limitations](#known-limitations)
- [Extending the app](#extending-the-app)

---

## Why this exists

Engineers inheriting a legacy codebase face three recurring problems this app is designed to shorten:

1. **"Where is the complexity concentrated?"** — a repo file tree tells you nothing about which modules matter most. The module graph answers this visually: node size and color both encode cyclomatic complexity, and the view is deliberately capped to the dozen files that are most connected and most recently touched, so attention goes to what's actually load-bearing instead of noise.
2. **"Why does this code look like this?"** — the file side panel and blame assistant both answer questions about a file by actually reading its git blame history, its merged pull requests, and its commit log. The side panel renders a plain-language explanation and a timeline of prior refactors; the assistant answers free-form questions the same way and can point at a specific line of code.
3. **"Is it safe to refactor this?"** — the Refactor Sandbox puts the legacy source and an AI-suggested modern rewrite side by side, backed by a focused impact analysis (complexity delta, regression-risk gauge) instead of a guess.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React 19** + **Vite 8** | No SSR requirement — the whole app is a client-side SPA. |
| Language | **TypeScript** (strict mode) | `tsconfig.json` targets ES2022, `noEmit` type-checking via `tsc --noEmit`. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Design tokens defined via `@theme` in [`src/index.css`](src/index.css); no `tailwind.config.js` needed under v4. |
| State | **Zustand** | Single flat store, no providers, no boilerplate reducers. |
| Graph rendering | **react-force-graph-2d** | Canvas-based force-directed layout, capped to a small (≤12) node subset per render. |
| Code editor | **@monaco-editor/react** | Same engine as VS Code; used for both sandbox panes with a custom light theme and a synthetic git-blame gutter. |
| Markdown | **marked** | Renders the per-file "legacy code explanation" markdown in the side panel. |
| Animation | **Framer Motion** | Subtle, organic 250–320ms ease-out transitions — no spring/bounce physics (see [Design system](#design-system)). |
| Icons | **lucide-react** | Standard technical iconography only (branch, commit, merge, lock, pencil, chevrons) — no sparkle/brain/wand icons anywhere. |
| Backend (unused) | `@supabase/supabase-js` | Present as a dependency and [`src/supabaseClient.js`](src/supabaseClient.js) from the original scaffold, but the current app is fully mock-data-driven and does not import it. Kept for future wiring. |
| Linting | **oxlint** | `npm run lint` |

## Getting started

```bash
npm install
npm run dev       # start the Vite dev server (http://localhost:5173)
npm run build     # production build via `vite build`
npm run preview   # serve the production build locally
npm run lint       # run oxlint
npx tsc --noEmit   # full TypeScript type-check (not wired into build/lint)
```

The UI needs the FastAPI backend running to show any data:

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
python main.py     # serves http://127.0.0.1:8000 (docs at /docs)
```

By default the backend analyzes the repository containing this project; point `TARGET_REPO_PATH` at any other local git repo to audit it instead. Optional: set `ANTHROPIC_API_KEY` (and `pip install anthropic`) to upgrade the chat assistant from the built-in deterministic analyst to real LLM answers; set `VITE_API_BASE_URL` to point the UI at a non-default backend address.

**Node.js requirement:** the project needs a recent Node.js LTS (v20+) with `npm` on `PATH`. If Node isn't installed system-wide, a portable Node build can be extracted anywhere and prepended to `PATH` for the session, e.g.:

```bash
# Windows PowerShell example
$env:Path = "C:\path\to\node-vX.Y.Z-win-x64;$env:Path"
```

## Project structure

```
Project101/
├─ index.html                  # Vite entry HTML; loads Inter + JetBrains Mono, light theme
├─ vite.config.js              # React + Tailwind v4 Vite plugins
├─ tsconfig.json               # Strict TS config, vite/client types
└─ src/
   ├─ main.tsx                 # ReactDOM root
   ├─ App.tsx                  # Top-level layout: TopBar + workspace (Graph|Sandbox) + collapsible ChatPane
   ├─ store.ts                 # Zustand store — the single source of app state
   ├─ types.ts                 # All domain types (RepoFile, Commit, PullRequest, ChatMessage, ImpactMetrics, …)
   ├─ index.css                # Tailwind v4 theme tokens + design-system utilities
   ├─ lib/
   │  ├─ api.ts                # Typed client for the FastAPI analysis engine (topology, history, chat, health)
   │  ├─ colors.ts             # Complexity color ramp (green → amber → red), node sizing
   │  └─ segments.ts           # Markdown → ChatSegment[] conversion + streaming-reveal helpers
   ├─ data/                    # ⚠ Retired mock prototype — no longer imported by any live code path
   │  ├─ mockRepo.ts           # Seeded repo generator: files, authors, commits, PRs, dependency edges, graph subset
   │  ├─ codegen.ts            # Per-file legacy/modern source synthesis + blame chunk assignment + impact analysis
   │  ├─ insights.ts           # Legacy-code markdown explanations, refactor timeline, commit-metric sparkline data
   │  └─ ai.ts                 # Mock "AI" response composer (superseded by the backend chat endpoint)
   └─ components/
      ├─ TopBar.tsx            # Header: branding, branch, high-complexity count, view switcher, assistant toggle
      ├─ GraphView.tsx         # Graph workspace shell: filter toolbar, canvas, status bar
      ├─ NodeGraph.tsx         # Canvas node/link rendering on react-force-graph-2d (capped subset)
      ├─ FileDrawer.tsx        # Slide-in side panel: metadata, sparklines, markdown explanation, refactor timeline
      ├─ ChatPane.tsx          # Blame assistant UI: streaming, quick actions, line-jump chips
      ├─ SandboxView.tsx       # Three-column refactor workspace (Monaco × 2 + ImpactReport)
      ├─ ImpactReport.tsx      # Complexity delta, regression-risk gauge, apply button
      └─ ui.tsx                # Shared primitives: SectionLabel, ComplexityBadge, Avatar, Stat, Sparkline, SkeletonLines
```

## Design system

The UI deliberately avoids the "AI product" visual language — no glows, gradients, bento grids, or sparkle icons — and avoids a dark hacker-terminal look in favor of a sophisticated, minimalist, paper-toned workspace:

- **Palette** — soft warm-beige/grey surfaces (`#F7F7F5` paper → `#EBEBE6` panel → `#FCFCFB` card), dark charcoal text (`#2A2A2A` ink, never pure black), and subtle `#D1D1CD`/`#BFBFBA` borders. All tokens are defined once in the `@theme` block of [`src/index.css`](src/index.css).
- **Functional color only** — color exists solely to encode cyclomatic complexity on a clearly visible (but non-neon) traffic-light ramp: green (`#2F9E44`, low) → amber (`#DDA01F`, medium) → red (`#D23F34`, high), computed as a continuous ramp by `complexityColor()` in `lib/colors.ts`. Chrome, buttons, and panel backgrounds stay neutral. Blame-gutter and author-avatar colors are the one exception (identity is data, so they stay tinted, with desaturated tones appropriate to a light background).
- **Flat, near-shadowless** — no glow, no blur, no heavy elevation. The one permitted shadow is `shadow-card` = `0 1px 2px rgba(0,0,0,0.05)`, used sparingly on floating panels.
- **Typography** — Inter (sans-serif) for all UI text; JetBrains Mono is reserved exclusively for actual code (Monaco panes, inline code chips, code blocks in chat) — never used for labels, metrics, or paths.
- **Motion** — organic, non-bouncy easing (`ease: [0.25, 0.1, 0.25, 1]` or `easeOut`), 200–320ms. No spring physics, no overshoot.
- **Density** — fixed multi-pane workbench layout; no floating cards or whitespace-heavy bento grids. Compact padding throughout.

## Core features

### 1. Module graph

**Files:** [`GraphView.tsx`](src/components/GraphView.tsx), [`NodeGraph.tsx`](src/components/NodeGraph.tsx), [`lib/colors.ts`](src/lib/colors.ts)

A pannable/zoomable force-directed canvas rendering a **capped subset of at most 12 files** (`graphSubset()` in `mockRepo.ts`) out of the full 56-file mock repository.

- **Subset selection** — files are ranked by a blend of dependency degree (how many edges touch them, in either direction) and modification recency (a 90-day recency window, weighted), then the top 12 are kept along with only the edges connecting them. This keeps the graph focused on the modules that are both structurally central and actively changing.
- **Node size** encodes cyclomatic complexity (`nodeRadius()` — square-root scaled so outliers don't dominate the layout).
- **Node color** encodes complexity on a continuous ramp (`complexityColor()`): green → amber → red as complexity rises.
- Files whose refactor has been **applied and staged** (see [Impact analysis](#5-impact-analysis)) render in green with a dashed ring, independent of their complexity color.
- **Filter toolbar** at the top accepts a small query grammar (below) that dims every non-matching node and link within the shown subset, preserving spatial context rather than removing nodes.
- **Status bar** at the bottom shows a complexity legend, a size legend, and either a match count while filtering or "top 12 of 56 files · by connectivity & recency".
- Clicking a node writes `selectedFileId` to the global store and opens the [file side panel](#2-file-side-panel); clicking empty canvas closes it. With ≤12 nodes on screen, filename labels render always-on rather than only on hover/zoom.

### 2. File side panel

**File:** [`FileDrawer.tsx`](src/components/FileDrawer.tsx)

A slide-in panel (anchored left, organic ease-out slide) shown when a node is selected:

- **Metadata header** — file identity (name, full path), a complexity badge, commit metrics from the backend's per-file analytics (average commit size, commits per month), and a compact stat row with total lines and total commits.
- **File summary** — a markdown write-up composed client-side (`liveExplanation()` in `FileDrawer.tsx`) from live data: the file's location, radon complexity band, author count and lead author from its commit timeline, and its first/most-recent commit dates — rendered to HTML via **marked** and styled through the `.prose-min` CSS class in `index.css`.
- **Commit timeline** — a vertical timeline of the file's recent commits from the backend's `git log --follow` pass, newest-first, each entry showing author, date, commit subject, and short hash.
- Two actions: **Open refactor sandbox** and **Ask assistant** (opens the blame assistant and immediately runs `explain-intent` for this file).

### 3. Blame assistant (contextual chat)

**Files:** [`ChatPane.tsx`](src/components/ChatPane.tsx), [`store.ts`](src/store.ts) (`askAI`), backend [`chat_service.py`](backend/app/services/chat_service.py)

A collapsible right-hand pane (toggled from the TopBar or the side panel's Ask assistant button).

**What it's grounded in:** every question is POSTed to `/api/v1/chat/contextual-blame` along with the selected file's path. The backend runs a real `git blame` on that file, scores each line's relevance against your question (keyword overlap over line content, commit message, and author), and answers from those records — via the Anthropic API when `ANTHROPIC_API_KEY` is configured, or a built-in deterministic analyst otherwise.

**Quick actions** (pills above the input) each send a purpose-built inquiry plus a typed `quickAction` tag, and the deterministic analyst shapes its reply accordingly:

| Action | Reply heading | What it returns |
|---|---|---|
| Explain intent | `Author intent` | Primary owner of the relevant line region and what the commit trail says about why the file is shaped this way |
| Find weaknesses | `Risk review` | The commit concentrating the most change across the relevant lines (review it first), plus commits to scrutinize and the authors behind them |
| History | `History lookup` | The isolated relevant lines, their authors, and the commits involved |

Free-form typed questions get the general `History lookup` treatment: the blame lines most relevant to your wording, with authors and commits.

**UI mechanics:**
- Responses **stream in** character-by-character (a `setInterval`-driven reveal over the message's segment list) with a soft caret — the backend reply arrives as one markdown payload and is revealed token-style client-side.
- **Inline code tokens** render as bordered `<code>` chips.
- **Line-reference chips** (e.g. `L27`) are clickable — clicking one calls `jumpToLine(fileId, line)` in the store, which opens the Refactor Sandbox for that file, scrolls the legacy editor to the line, and flashes it briefly so the connection between "what the assistant said" and "the actual code" is never ambiguous.
- **Code blocks** get a small regex-based syntax highlighter (keywords, strings, numbers, PascalCase types, function calls, comments) tuned for the mock TS/JS output — see `TOKEN_RX` in `ChatPane.tsx`.
- A "Reading blame context" indicator shows while the request is in flight against the backend.

### 4. Refactor Sandbox

**File:** [`SandboxView.tsx`](src/components/SandboxView.tsx)

A three-column workspace, reached via a file's side-panel action, a chat line-jump, or the TopBar's view switcher (disabled until a file has been opened into the sandbox at least once).

1. **Legacy source** (left) — read-only Monaco, `javascript` mode, rendering the synthesized "problematic" callback-era version of the file. The line-number gutter is **replaced** with a synthetic git-blame readout: `<commit-hash> <author-handle> <line-number>` per line, generated by walking the file's real commit list in contiguous chunks (`getFileCode().blame`). Hovering a line shows a tooltip with author name, commit hash, and relative time. A `.blame-bar-N` colored bar (author-indexed) marks the left edge of each blamed region.
2. **Modernized** (middle) — editable Monaco, `typescript` mode, pre-populated with an AI-suggested rewrite (async/await, typed interfaces, parameterized queries, `Promise.allSettled` batching). Edits are kept in the Zustand store per file ID (`modernDrafts`) so they survive navigating away and back.
3. **Analysis** (right) — the [impact analysis](#5-impact-analysis).

Both editors share a custom light theme (`gitdash-light`, `#FCFCFB` background) matching the app's paper palette rather than Monaco's default dark theme, and a shared `BASE_OPTIONS` config (12px JetBrains Mono, no minimap, no context menu, folding disabled, `blink` cursor) for a flat, dense look consistent with the rest of the app.

### 5. Impact analysis

**File:** [`ImpactReport.tsx`](src/components/ImpactReport.tsx), computed by `computeImpact()` in [`data/codegen.ts`](src/data/codegen.ts)

A deterministic (seeded per-file) heuristic analysis of the proposed refactor, intentionally scoped to two signals:

- **Complexity delta** — a 34–62% reduction is computed from the file's actual complexity score, shown as a before/after bar pair and a percentage figure, plus the underlying lines-of-code before/after.
- **Regression risk gauge** (low/medium/high) — driven by the number of dependent files and the file's current test coverage: ≥5 dependents or <20% coverage escalates to high; ≥2 dependents or <45% coverage is medium; otherwise low.
- **Apply refactor & stage** button — on click, simulates a ~1.1s staging operation (`window.setTimeout`) then marks the file as refactored in the store (`applyRefactor`). This immediately updates the file's node color back in the module graph (green fill, dashed ring) even though the sandbox view doesn't re-render the graph — state is shared globally via Zustand.

## Mock data engine

> **Retired prototype.** Nothing in the live app imports these modules anymore — the graph, side panel, sandbox, and chat are all served by the FastAPI backend. This section documents the original prototype engine, which remains in the tree under `src/data/`.

**Files:** [`data/mockRepo.ts`](src/data/mockRepo.ts), [`data/codegen.ts`](src/data/codegen.ts), [`data/insights.ts`](src/data/insights.ts), [`data/ai.ts`](src/data/ai.ts)

Everything the app displays — file list, complexity/churn numbers, commit messages, PR descriptions, blame chunks, source code, legacy explanations, refactor timelines, and chat answers — is generated by a **deterministic seeded PRNG** (`mulberry32`), so the same "legacy monolith" renders identically on every page load. There is no randomness variance between sessions; two users looking at `PaymentProcessor.js` see byte-identical mock content.

**Repository shape** — `buildFiles()` walks 10 directory blueprints (`src/legacy`, `src/core`, `src/api`, `src/services`, `src/components`, `src/hooks`, `src/utils`, `src/db`, `scripts`, `tests`), each with its own complexity/churn/LOC ranges and a short description, producing **56 files** total. `src/legacy` is deliberately the highest-complexity, highest-churn, lowest-coverage directory. The module graph then narrows this down to a **12-file subset** via `graphSubset()` (see [Module graph](#1-module-graph)).

For each file the engine also generates:
- **8 authors** with realistic name/handle pairs and an index-matched muted color for blame visualization
- **Commits** — pulled from weighted message pools (`FIX_MESSAGES`, `FEAT_MESSAGES`, `CHORE_MESSAGES`, `BUG_MESSAGES`), with ~18% flagged as "sloppy" (bug-introducing) and randomized author attribution weighted by the file's ownership split
- **Author share** — 2–5 contributors per file with percentages summing to 100
- **Bug-linked commits** — the top 2–3 commits by `bugsIntroduced` count, guaranteed non-empty per file
- **Pull requests** — 2–4 per file, titles/descriptions built from six PR narrative templates (`PR_TEMPLATES`) that reference the file's topic and name, so they read as plausible engineering history rather than lorem ipsum
- **Dependency edges** — directory-to-directory import rules (`IMPORT_RULES`, e.g. `src/api` imports from `src/services`, `src/core`, `src/utils`, `src/legacy`) used to build a realistic-looking, non-random dependency graph

**Source code synthesis** (`codegen.ts`) — each file seeds its **own** PRNG from its path (so output is stable regardless of render/fetch order) and produces:
- A **legacy** callback-style JS source (~70 lines) with intentionally recognizable anti-patterns: an unbounded module-level cache, string-concatenated SQL, a fixed-timer infinite retry loop, and a validation fallthrough that silently approves on error — these are exactly the weaknesses the "find weaknesses" chat action describes
- A **modern** async/await TypeScript rewrite with typed interfaces, parameterized queries, `Promise.allSettled`, and a bounded LRU-ish cache — same three public exports (`process*`, `validate*`, `sync*Records`), so the sandbox's transformation is literally consistent between the two panes
- **Blame chunks** — contiguous line ranges cycled across the file's real commit list, so the blame gutter in the sandbox and the line-references in chat answers point at commits that actually exist in that file's history

**Insights** (`insights.ts`) — reads the same structures (PRs, commits, authorship, dependents) to produce the side panel's markdown explanation, its refactor timeline, and the raw arrays behind the commit-size and commit-frequency sparklines.

**Mock AI composer** (`ai.ts`) — not a real LLM call. `composeResponse()` builds an ordered list of typed segments (`text`, `inline` code, `lineref` chips, syntax-highlighted `block`s) by reading the same structures above. The ChatPane then streams that segment list into view; `segmentsLength()`/`sliceSegments()` handle the character-count-based reveal animation.

## State management

**File:** [`store.ts`](src/store.ts) — a single flat Zustand store (`useDashboard`), no context providers, no reducers.

| Slice | Fields | Purpose |
|---|---|---|
| Navigation | `view` (`"graph"` \| `"sandbox"`), `activeFileId`, `drawerOpen`, `searchQuery` | Drives which workspace is mounted and what's selected/filtered in the graph |
| Repository | `files`, `edges`, `repoName`, `branch`, `repoStatus`, `repoError` | Live topology hydrated from `GET /api/v1/repository/topology` on boot |
| Active file | `activeFileSource`, `activeModernized`, `activeAnalytics`, `refactorTimeline`, `historyStatus`, `historyError` | Per-file history from `GET /api/v1/file/history`, fetched by a store **subscription middleware** whenever `activeFileId` changes (stale responses are dropped) |
| Chat | `chatOpen`, `messages`, `aiThinking` | Blame assistant pane visibility and conversation state |
| Sandbox | `sandboxFileId`, `modernDrafts` (per-file editable-pane text), `refactoredIds` (applied refactors), `revealTarget` (`{ fileId, line, nonce }` for line-jump-triggered scroll+flash) | Refactor Sandbox state, kept independent from `activeFileId` so opening the sandbox doesn't have to touch graph selection |

Key actions: `loadRepository`, `selectFile`, `openSandbox`, `askAI` (posts the question — and the `quickAction` tag for pill clicks — to the backend's contextual-blame endpoint, then pushes the streamed reply), `applyRefactor`, `jumpToLine` (cross-cuts chat → sandbox navigation).

## Data model reference

**File:** [`types.ts`](src/types.ts) — the full domain vocabulary:

- `RepoFile` — path/name/dir/ext/lang, `loc`, `complexity`, `churn`, `totalCommits`, `authorShare[]`, `commits[]`, `bugCommits[]`, `prs[]`, `debtScore`, `risk`, `coverage`, `description`
- `Author` — id/name/handle/initials, `colorIndex` + resolved `color` for blame rendering
- `Commit` — hash, message, authorId, date, additions/deletions, `bugsIntroduced`
- `PullRequest` — number, title, description, authorId, mergedAt
- `BlameChunk` — startLine/endLine, commitHash, authorId, date
- `DepEdge` / `Repo` — the dependency graph and top-level repo metadata (name, branch, files, edges, authors)
- `ChatSegment` — discriminated union: `text` \| `inline` \| `lineref` \| `block`, the atomic unit the blame assistant streams
- `ChatMessage`, `QuickAction` — chat state shapes
- `ImpactMetrics` — the impact analysis payload (complexity before/after/delta%, LOC before/after, regression risk)

## Search grammar

The module graph's filter toolbar (`useMatchedIds()` in `GraphView.tsx`) accepts space-separated tokens, ANDed together, and operates over the currently shown ≤12-file subset:

| Token pattern | Matches |
|---|---|
| `payment` | Substring match anywhere in the file's path |
| `.ts`, `.tsx`, `.js` | Exact extension match |
| `src/legacy` | Substring match on path (works as a directory filter) |
| `author:schen` | Files where that author (by handle or name, case-insensitive substring) has an authorship share |

Example: `.ts author:pnair` → TypeScript files, among those currently shown, that Priya Nair has touched.

## Styling conventions

- All Tailwind design tokens (colors, fonts) are declared once via `@theme` in `index.css` — component code should reference `bg-paper`, `bg-panel`, `bg-card`, `text-ink`/`text-body`/`text-muted`/`text-faint`, `border-edge`/`border-edge-2`, etc. rather than hard-coding hex values, except where a value must be computed at runtime (complexity colors) via `lib/colors.ts`.
- Prefer the shared primitives in `components/ui.tsx` (`SectionLabel`, `ComplexityBadge`, `Avatar`, `AvatarStack`, `Stat`, `Sparkline`, `SkeletonLines`) over ad hoc markup for anything that repeats across panels.
- All interactive transitions should stay in the **200–320ms, ease-out** range to match the rest of the app; avoid introducing spring/bounce easing or anything longer/snappier.
- Icons: only literal, standard technical glyphs from `lucide-react` (git-branch, git-commit, git-merge, git-pull-request, lock, pencil, chevrons, search, X). Do not introduce sparkle/brain/wand icons for AI-related UI — the product frames itself as a **blame assistant**, not a magical agent.
- Monospace (`font-mono`, JetBrains Mono) is reserved for actual code — Monaco panes and chat inline/block code — never for UI labels, paths, or metrics, which use the sans-serif `Inter` stack.

## Known limitations

- **Monaco loads from a CDN** at runtime via the default `@monaco-editor/react` loader — the Refactor Sandbox requires internet connectivity even though the rest of the app is fully offline-capable. Self-hosting the Monaco assets would remove this dependency if needed.
- **No persistence** — refresh the page and all state resets (selected file, chat history, staged refactors, sandbox edits). Repository data is re-fetched from the backend, but session state (Zustand) is in-memory only.
- **`@supabase/supabase-js` and `src/supabaseClient.js`** are present but unused — a real backend integration (persisting refactors, real git history ingestion, a real LLM call for the assistant) is not wired up.
- **Bundle size** — the production build currently emits a single ~620KB JS chunk (react-force-graph + Framer Motion + Monaco types + marked dominate). `vite build` warns about this; code-splitting the Sandbox route behind `React.lazy` would address it if it becomes a concern.
- **The graph subset is recomputed once per mount**, not live — it does not re-rank as you interact with the app (e.g., staging a refactor doesn't change which 12 files are shown).
- The AI assistant **defaults to a deterministic analyst** — without `ANTHROPIC_API_KEY` set on the backend, replies are template-composed from real `git blame` data (per-action headings: *Author intent*, *Risk review*, *History lookup*) rather than generated by a model. Setting the key upgrades all replies to real LLM answers grounded in the same blame records.

## Extending the app

- **Analyze a different repo:** set `TARGET_REPO_PATH` on the backend to the absolute path of any local git repository — no frontend changes needed.
- **Upgrade the assistant to a real LLM:** set `ANTHROPIC_API_KEY` (and `pip install anthropic`) for the backend; `chat_service.py` switches from the deterministic analyst to Anthropic-generated answers automatically, grounded in the same blame records.
- **True token streaming:** the backend returns each chat reply as one payload and the UI reveals it client-side; adapting `ChatPane.tsx`'s streaming logic to consume a real SSE/token stream is the natural next step.
- **Add persistence:** the Supabase client is already a dependency; the natural extension point is persisting `refactoredIds` and `modernDrafts` from the Zustand store.
