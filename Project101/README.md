# Git Dashboard

A technical-debt visualizer, onboarding aid, and refactor sandbox for legacy repositories. It renders a repository as an interactive, force-directed node graph — sized by cyclomatic complexity, colored by commit churn — and pairs it with a blame-aware terminal assistant and a side-by-side refactor workspace built on Monaco.

The entire app runs against a **deterministic, seeded mock data engine**: a synthetic 56-file legacy monolith with realistic directories, dependency edges, authors, commit history, pull requests, and per-file source code. No backend or network dependency is required to explore the product (Monaco's editor engine itself loads from a CDN at runtime; everything else is local).

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Design system](#design-system)
- [Core features](#core-features)
  - [1. Debt graph (node visualizer)](#1-debt-graph-node-visualizer)
  - [2. File inspector drawer](#2-file-inspector-drawer)
  - [3. Terminal Assistant (blame-aware chat)](#3-terminal-assistant-blame-aware-chat)
  - [4. Refactor Sandbox](#4-refactor-sandbox)
  - [5. Impact Report](#5-impact-report)
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

1. **"Where is the debt?"** — a repo file tree tells you nothing about which files are risky. Git Dashboard answers this visually: node size = complexity, node color = churn/risk, so hotspots are obvious at a glance instead of buried in a linter report.
2. **"Why does this code look like this?"** — the Terminal Assistant answers questions about a file by actually reading its blame history, its merged pull requests, and its commit log, and grounds every answer in a specific line of code you can jump to.
3. **"Is it safe to refactor this?"** — the Refactor Sandbox puts the legacy source, an AI-suggested modern rewrite, and an automated impact/regression-risk report side by side, so a decision to refactor is backed by data (complexity delta, coverage estimate, blast radius) instead of a guess.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React 19** + **Vite 8** | No SSR requirement — the whole app is a client-side SPA, so Vite was kept over migrating to Next.js. |
| Language | **TypeScript** (strict mode) | `tsconfig.json` targets ES2022, `noEmit` type-checking via `tsc --noEmit`. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Design tokens defined via `@theme` in [`src/index.css`](src/index.css); no `tailwind.config.js` needed under v4. |
| State | **Zustand** | Single flat store, no providers, no boilerplate reducers. |
| Graph rendering | **react-force-graph-2d** | Canvas-based force-directed layout; chosen over React Flow for organic physics and cheap heat-based node rendering at 50+ nodes. |
| Code editor | **@monaco-editor/react** | Same engine as VS Code; used for both sandbox panes with a custom dark theme and a synthetic git-blame gutter. |
| Animation | **Framer Motion** | Used sparingly and fast — 150ms linear transitions only (see [Design system](#design-system)). |
| Icons | **lucide-react** | Standard technical iconography only (terminal, branch, chevrons, lock, pencil) — no sparkles/magic-wand icons anywhere. |
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

No environment variables or backend services are required — the mock data engine generates the entire repository in-memory on module load.

**Node.js requirement:** the project needs a recent Node.js LTS (v20+) with `npm` on `PATH`. If Node isn't installed system-wide, a portable Node build can be extracted anywhere and prepended to `PATH` for the session, e.g.:

```bash
# Windows PowerShell example
$env:Path = "C:\path\to\node-vX.Y.Z-win-x64;$env:Path"
```

## Project structure

```
Project101/
├─ index.html                  # Vite entry HTML; loads Inter + JetBrains Mono, dark theme by default
├─ vite.config.js              # React + Tailwind v4 Vite plugins
├─ tsconfig.json               # Strict TS config, vite/client types
└─ src/
   ├─ main.tsx                 # ReactDOM root
   ├─ App.tsx                  # Top-level layout: TopBar + workspace (Graph|Sandbox) + collapsible ChatPane
   ├─ store.ts                 # Zustand store — the single source of app state
   ├─ types.ts                 # All domain types (RepoFile, Commit, PullRequest, ChatMessage, ImpactMetrics, …)
   ├─ index.css                # Tailwind v4 theme tokens + design-system utilities
   ├─ lib/
   │  └─ colors.ts             # Risk/heatmap color logic, node sizing, debt-score coloring
   ├─ data/
   │  ├─ mockRepo.ts           # Seeded repo generator: files, authors, commits, PRs, dependency edges
   │  ├─ codegen.ts            # Per-file legacy/modern source synthesis + blame chunk assignment
   │  └─ ai.ts                 # Mock "AI" response composer (context-grounded, not a real LLM call)
   └─ components/
      ├─ TopBar.tsx            # Header: branding, branch, hotspot count, view switcher, assistant toggle
      ├─ GraphView.tsx         # Graph workspace shell: filter toolbar, canvas, status bar
      ├─ NodeGraph.tsx         # Canvas node/link rendering on react-force-graph-2d
      ├─ FileDrawer.tsx        # Slide-in inspector panel for the selected file
      ├─ ChatPane.tsx          # Terminal Assistant UI: streaming, quick actions, line-jump chips
      ├─ SandboxView.tsx       # Three-column refactor workspace (Monaco × 2 + ImpactReport)
      ├─ ImpactReport.tsx      # Complexity delta, regression gauge, coverage estimate, apply button
      └─ ui.tsx                # Shared primitives: SectionLabel, RiskBadge, Avatar, MonoStat, SkeletonLines
```

## Design system

The UI intentionally avoids typical "AI product" visual language (no glows, gradients, bento grids, sparkle icons, or bouncy spring physics). It is modeled after IDE/terminal density instead:

- **Palette** — matte charcoal surfaces (`#181818` obsidian → `#1e1e1e` ink → `#252525` ink-2), a low-contrast neutral text scale (`#d4d4d4` bright → `#9d9d9d` muted → `#6e6e6e` faint), and `#333`/`#454545` structural borders. All tokens are defined once in the `@theme` block of [`src/index.css`](src/index.css).
- **Functional color only** — color is reserved for data states, following git-diff semantics: green (`#3fb950`) = additions / low risk / staged, red (`#f85149`) = deletions / high risk, amber (`#d29922`) = warnings / medium risk. Chrome, buttons, and panel backgrounds stay neutral.
- **No glow, no gradient, no blur** — flat fills, 1px solid borders, square corners throughout. Blame-gutter and author-avatar colors are the one exception (identity is data, so they stay tinted, but with desaturated matte tones — see `AUTHOR_COLORS` in `mockRepo.ts` and `.blame-bar-N` classes in `index.css`).
- **Typography** — Inter for UI text, JetBrains Mono for anything code-, path-, hash-, or metric-shaped (nearly everything is mono, in keeping with the terminal aesthetic).
- **Motion** — every transition is a fast, linear 150ms (`transition: { duration: 0.15, ease: "linear" }` in Framer Motion, `duration-150` in Tailwind). No spring physics, no bounce, no floaty easing.
- **Density** — fixed multi-pane workbench layout; no floating cards, no whitespace-heavy bento grids. Compact padding throughout.

## Core features

### 1. Debt graph (node visualizer)

**Files:** [`GraphView.tsx`](src/components/GraphView.tsx), [`NodeGraph.tsx`](src/components/NodeGraph.tsx), [`lib/colors.ts`](src/lib/colors.ts)

A full-bleed, pannable/zoomable force-directed canvas rendering all 56 mock repo files as nodes, connected by their (synthetic) import edges.

- **Node size** encodes cyclomatic complexity (`nodeRadius()` — square-root scaled so outliers don't dominate the layout).
- **Node color** encodes a churn/complexity heatmap (`nodeColor()` / `riskOf()`):
  - `high` risk → red — heavy complexity **and** heavy 90-day churn
  - `medium` risk → amber — moderate combined heat
  - `low` risk → green (or neutral slate for very quiet, rarely touched files, so the map doesn't read all-green)
- Files whose refactor has been **applied and staged** (see [Impact Report](#5-impact-report)) render in green with a dashed ring, independent of their original risk color.
- **Filter toolbar** at the top of the canvas accepts a small query grammar (below) that dims every non-matching node and link to near-invisible instead of removing them, preserving spatial context.
- **Status bar** at the bottom shows a heatmap legend, a size legend, and a live "N/56 match" counter while filtering.
- Clicking a node opens the [File Drawer](#2-file-inspector-drawer); clicking empty canvas closes it. Hovering a node shows its filename label and a hover ring; the engine auto-fits the viewport to the graph once the initial physics simulation settles.

### 2. File inspector drawer

**File:** [`FileDrawer.tsx`](src/components/FileDrawer.tsx)

A slide-in panel (150ms linear slide, anchored left) shown when a node is selected:

- File identity (name, full path, risk badge)
- **Debt meter** — an animated 0–100 bar, colored by `debtScoreColor()` (red ≥70, amber ≥40, green below)
- File description (directory-level blurb from the mock data)
- A 3×2 stat grid: **Lines**, **Complexity**, **Churn/90d**, **Coverage**, **Commits**, **Dependents** (dependents computed live from the dependency graph via `dependentsOf()`)
- Two actions: **Open Refactor Sandbox** (routes to the sandbox view with this file loaded) and **Assistant** (opens the Terminal Assistant and immediately runs `/explain-intent` for this file)

The drawer is deliberately scoped to identity + metrics + navigation — it does not duplicate author-ownership breakdowns, bug-commit lists, or PR history as static UI. That richer detail (`file.authorShare`, `file.bugCommits`, `file.prs`) still exists in the mock data and powers the Terminal Assistant's `/find-weaknesses` and `/history` responses instead, keeping the drawer itself dense but glanceable.

### 3. Terminal Assistant (blame-aware chat)

**Files:** [`ChatPane.tsx`](src/components/ChatPane.tsx), [`data/ai.ts`](src/data/ai.ts)

A collapsible right-hand pane (toggled from the TopBar or the drawer's Assistant button) framed explicitly as a **console**, not a chatbot — `$`/`❯` prompt glyphs, a `SquareTerminal` icon, and an uppercase "TERMINAL ASSISTANT" header instead of any AI/magic branding.

**What it's "grounded" in:** every response is composed from the selected file's actual mock context — its synthesized source code, its per-line git-blame chunks, its merged pull request titles/descriptions, and its commit history — not a canned string. See [Mock data engine](#mock-data-engine) below for how that context is generated.

**Quick commands** (pills above the input, also runnable by typing `/command`):

| Command | What it returns |
|---|---|
| `/explain-intent` | Directory role, primary owner, an architectural-intent narrative synthesized from the oldest and newest merged PRs on the file, and a pointer to the specific blame chunk where behavior has drifted from that intent |
| `/find-weaknesses` | Four concrete, line-referenced weaknesses (unbounded cache, injection-shaped string concatenation, silent-failure defaults, uncapped retry loop) plus the highest bug-yield commit and a safe-code sketch |
| `/history` | Recent commit list with author, relative time, +/− line counts, and bug-linkage flags; author ownership split; most recent merged PR |

Free-form questions are also grounded — the composer pattern-matches on keywords (`test`/`coverage`, `depend`/`import`/`break`, `who`/`author`/`owner`) to route to a relevant, context-specific answer instead of a generic fallback.

**UI mechanics:**
- Responses **stream in** character-by-character (a `setInterval`-driven reveal over the message's segment list) with a blinking block caret, simulating token-by-token generation without a real network call.
- **Inline code tokens** render as bordered `<code>` chips.
- **Line-reference chips** (e.g. `L27`) are clickable — clicking one calls `jumpToLine(fileId, line)` in the store, which opens the Refactor Sandbox for that file, scrolls the legacy editor to the line, and flashes it briefly so the connection between "what the assistant said" and "the actual code" is never ambiguous.
- **Code blocks** get a small regex-based syntax highlighter (keywords, strings, numbers, PascalCase types, function calls, comments) tuned for the mock TS/JS output — see `TOKEN_RX` in `ChatPane.tsx`.
- A lightweight "thinking" delay (550–1200ms, randomized) precedes each response to simulate latency before streaming begins.

### 4. Refactor Sandbox

**File:** [`SandboxView.tsx`](src/components/SandboxView.tsx)

A three-column IDE-style workspace, reached via a file's drawer action, a chat line-jump, or the TopBar's view switcher (disabled until a file has been opened into the sandbox at least once).

1. **Legacy source** (left) — read-only Monaco, `javascript` mode, rendering the synthesized "problematic" callback-era version of the file. The line-number gutter is **replaced** with a synthetic git-blame readout: `<commit-hash> <author-handle> <line-number>` per line, generated by walking the file's real commit list in contiguous chunks (`getFileCode().blame`). Hovering a line shows a tooltip with author name, commit hash, and relative time. A `.blame-bar-N` colored bar (matte, author-indexed) marks the left edge of each blamed region.
2. **Modernized** (middle) — editable Monaco, `typescript` mode, pre-populated with an AI-suggested rewrite (async/await, typed interfaces, parameterized queries, `Promise.allSettled` batching). Edits are kept in the Zustand store per file ID (`modernDrafts`) so they survive navigating away and back.
3. **Automated analysis** (right) — the [Impact Report](#5-impact-report).

Both editors share a custom dark theme (`gitdash`) matching the app's matte charcoal palette (not Monaco's default `vs-dark` blue-black), and a shared `BASE_OPTIONS` config (12px JetBrains Mono, no minimap, no context menu, folding disabled, `blink` cursor instead of a phase animation) for a flatter, denser look consistent with the rest of the app.

### 5. Impact Report

**File:** [`ImpactReport.tsx`](src/components/ImpactReport.tsx), computed by `computeImpact()` in [`data/codegen.ts`](src/data/codegen.ts)

A deterministic (seeded per-file) static/heuristic analysis of the proposed refactor:

- **Complexity delta** — a 34–62% reduction is computed from the file's actual complexity score, shown as a before/after bar pair and a percentage figure.
- **Regression risk gauge** (low/medium/high) — driven by the number of dependent files (`dependentsOf()`) and the file's current test coverage: ≥5 dependents or <20% coverage escalates to high; ≥2 dependents or <45% coverage is medium; otherwise low.
- **Test coverage impact** — before/after estimate (+14 to +36 points), reasoned as "typed signatures and extracted pure functions make previously-untested branches directly unit-testable."
- **Blast radius** — literal count of dependent files, with a note that public export names/arity are preserved (call sites only need to adopt `async`).
- **Apply refactor & stage** button — on click, simulates a ~1.1s staging operation (`window.setTimeout`) then marks the file as refactored in the store (`applyRefactor`). This immediately updates the file's node color back in the Debt Graph (green fill, dashed ring) even though the sandbox view doesn't re-render the graph — state is shared globally via Zustand.

## Mock data engine

**Files:** [`data/mockRepo.ts`](src/data/mockRepo.ts), [`data/codegen.ts`](src/data/codegen.ts), [`data/ai.ts`](src/data/ai.ts)

Everything the app displays — file list, complexity/churn numbers, commit messages, PR descriptions, blame chunks, source code, and AI answers — is generated by a **deterministic seeded PRNG** (`mulberry32`), so the same "legacy monolith" renders identically on every page load. There is no randomness variance between sessions; two users looking at `PaymentProcessor.js` see byte-identical mock content.

**Repository shape** — `buildFiles()` walks 10 directory blueprints (`src/legacy`, `src/core`, `src/api`, `src/services`, `src/components`, `src/hooks`, `src/utils`, `src/db`, `scripts`, `tests`), each with its own complexity/churn/LOC ranges and a short description, producing **56 files** total. `src/legacy` is deliberately the highest-complexity, highest-churn, lowest-coverage directory — the intended "start here" hotspot for a first-time visitor.

For each file the engine also generates:
- **8 authors** with realistic name/handle pairs and an index-matched muted color for blame visualization
- **Commits** — pulled from weighted message pools (`FIX_MESSAGES`, `FEAT_MESSAGES`, `CHORE_MESSAGES`, `BUG_MESSAGES`), with ~18% flagged as "sloppy" (bug-introducing) and randomized author attribution weighted by the file's ownership split
- **Author share** — 2–5 contributors per file with percentages summing to 100
- **Bug-linked commits** — the top 2–3 commits by `bugsIntroduced` count, guaranteed non-empty per file
- **Pull requests** — 2–4 per file, titles/descriptions built from six PR narrative templates (`PR_TEMPLATES`) that reference the file's topic and name, so they read as plausible engineering history rather than lorem ipsum
- **Dependency edges** — directory-to-directory import rules (`IMPORT_RULES`, e.g. `src/api` imports from `src/services`, `src/core`, `src/utils`, `src/legacy`) used to build a realistic-looking, non-random dependency graph

**Source code synthesis** (`codegen.ts`) — each file seeds its **own** PRNG from its path (so output is stable regardless of render/fetch order) and produces:
- A **legacy** callback-style JS source (~70 lines) with intentionally recognizable anti-patterns: an unbounded module-level cache, string-concatenated SQL, a fixed-timer infinite retry loop, and a validation fallthrough that silently approves on error — these are exactly the weaknesses `/find-weaknesses` describes
- A **modern** async/await TypeScript rewrite with typed interfaces, parameterized queries, `Promise.allSettled`, and a bounded LRU-ish cache — same three public exports (`process*`, `validate*`, `sync*Records`), so the "impact" narrative about preserved call signatures is literally true of the generated code
- **Blame chunks** — contiguous line ranges cycled across the file's real commit list, so the blame gutter in the sandbox and the line-references in chat answers point at commits that actually exist in that file's history

**Mock AI composer** (`ai.ts`) — not a real LLM call. `composeResponse()` builds an ordered list of typed segments (`text`, `inline` code, `lineref` chips, syntax-highlighted `block`s) by reading the same structures above: blame chunks, PR descriptions, commit messages, coverage numbers, dependents. The ChatPane then streams that segment list into view; `segmentsLength()`/`sliceSegments()` handle the character-count-based reveal animation.

## State management

**File:** [`store.ts`](src/store.ts) — a single flat Zustand store (`useDashboard`), no context providers, no reducers.

| Slice | Fields | Purpose |
|---|---|---|
| Navigation | `view` (`"graph"` \| `"sandbox"`), `selectedFileId`, `drawerOpen`, `searchQuery` | Drives which workspace is mounted and what's selected/filtered in the graph |
| Chat | `chatOpen`, `messages`, `aiThinking` | Terminal Assistant pane visibility and conversation state |
| Sandbox | `sandboxFileId`, `modernDrafts` (per-file editable-pane text), `refactoredIds` (applied refactors), `revealTarget` (`{ fileId, line, nonce }` for line-jump-triggered scroll+flash) | Refactor Sandbox state, kept independent from `selectedFileId` so opening the sandbox doesn't have to touch graph selection |

Key actions: `selectFile`, `openSandbox`, `askAI` (posts a user message, then after a simulated delay pushes a streaming AI message via `composeResponse`), `applyRefactor`, `jumpToLine` (cross-cuts chat → sandbox navigation).

## Data model reference

**File:** [`types.ts`](src/types.ts) — the full domain vocabulary:

- `RepoFile` — path/name/dir/ext/lang, `loc`, `complexity`, `churn`, `totalCommits`, `authorShare[]`, `commits[]`, `bugCommits[]`, `prs[]`, `debtScore`, `risk`, `coverage`, `description`
- `Author` — id/name/handle/initials, `colorIndex` + resolved `color` for blame rendering
- `Commit` — hash, message, authorId, date, additions/deletions, `bugsIntroduced`
- `PullRequest` — number, title, description, authorId, mergedAt
- `BlameChunk` — startLine/endLine, commitHash, authorId, date
- `DepEdge` / `Repo` — the dependency graph and top-level repo metadata (name, branch, files, edges, authors)
- `ChatSegment` — discriminated union: `text` \| `inline` \| `lineref` \| `block`, the atomic unit the Terminal Assistant streams
- `ChatMessage`, `QuickAction` — chat state shapes
- `ImpactMetrics` — the full Impact Report payload (complexity before/after/delta%, LOC before/after, regression risk, coverage before/after, affected dependents)

## Search grammar

The Debt Graph's filter toolbar (`useMatchedIds()` in `GraphView.tsx`) accepts space-separated tokens, ANDed together:

| Token pattern | Matches |
|---|---|
| `payment` | Substring match anywhere in the file's path |
| `.ts`, `.tsx`, `.js` | Exact extension match |
| `src/legacy` | Substring match on path (works as a directory filter) |
| `author:schen` | Files where that author (by handle or name, case-insensitive substring) has an authorship share |

Example: `.ts src/services author:pnair` → TypeScript files in `src/services` that Priya Nair has touched.

## Styling conventions

- All Tailwind design tokens (colors, fonts) are declared once via `@theme` in `index.css` — component code should reference `bg-obsidian`, `text-faint`, `border-edge`, `text-add`/`text-del`/`text-warn`, etc. rather than hard-coding hex values, except where a value must be computed at runtime (risk colors, author colors) via `lib/colors.ts`.
- Prefer the shared primitives in `components/ui.tsx` (`SectionLabel`, `RiskBadge`, `MonoStat`, `Avatar`, `AvatarStack`, `SkeletonLines`, `Kbd`) over ad hoc markup for anything that repeats across panels.
- All interactive transitions should stay at **150ms, linear** to match the rest of the app; avoid introducing spring/bounce easing.
- Icons: only literal, standard technical glyphs from `lucide-react` (terminal, git-branch, git-commit, git-merge, lock, pencil, chevrons, search, X). Do not introduce sparkle/brain/wand icons for AI-related UI — the product frames itself as a **Terminal Assistant**, not a magical agent.

## Known limitations

- **Monaco loads from a CDN** at runtime via the default `@monaco-editor/react` loader — the Refactor Sandbox requires internet connectivity even though the rest of the app is fully offline-capable. Self-hosting the Monaco assets would remove this dependency if needed.
- **No persistence** — refresh the page and all state resets (selected file, chat history, staged refactors, sandbox edits). The mock repo itself regenerates identically (seeded), but session state (Zustand) is in-memory only.
- **`@supabase/supabase-js` and `src/supabaseClient.js`** are present but unused — a real backend integration (persisting refactors, real git history ingestion, a real LLM call for the assistant) is not wired up.
- **Bundle size** — the production build currently emits a single ~580KB JS chunk (react-force-graph + Framer Motion + Monaco types dominate). `vite build` warns about this; code-splitting the Sandbox route behind `React.lazy` would address it if it becomes a concern.
- The AI assistant is **not a real model call** — it's a context-grounded template composer (`data/ai.ts`). It's designed to demonstrate the *product interaction* (grounded, line-referenced, streaming answers) rather than to generate genuinely novel analysis.

## Extending the app

- **Swap in a real repo:** replace `data/mockRepo.ts`'s generator with real `git log`/`git blame` ingestion (e.g., via `isomorphic-git` or a backend endpoint) while keeping the `RepoFile`/`Commit`/`PullRequest`/`BlameChunk` shapes in `types.ts` — the rest of the app (graph, drawer, sandbox, blame gutter) consumes those types directly and shouldn't need to change.
- **Swap in a real AI backend:** replace `composeResponse()` in `data/ai.ts` with an actual API call that streams `ChatSegment[]`-shaped output (or adapt `ChatPane.tsx`'s streaming logic to consume a real SSE/token stream instead of the character-count simulation).
- **Add persistence:** the Supabase client is already a dependency; the natural extension point is persisting `refactoredIds` and `modernDrafts` from the Zustand store.
