# Git Codebase Analysis Dashboard

An interactive workbench for auditing any local Git repository: a force-directed
module graph of the highest-churn files (sized and colored by cyclomatic
complexity), per-file history analytics, a side-by-side legacy/modernized code
comparison built on Monaco, and a blame-grounded chat assistant.

---

## 1. System Architecture Overview

The system is two cooperating processes connected over the local network:

```
┌──────────────────────────┐        HTTP / JSON (CORS enabled)        ┌───────────────────────────┐
│  Vite / React UI          │  ──────────────────────────────────────▶ │  FastAPI analysis engine   │
│  http://localhost:5173    │                                          │  http://localhost:8000     │
│                           │   GET  /api/v1/repository/topology       │                            │
│  react-force-graph-2d     │   GET  /api/v1/file/history?path=…       │  git log / blame / numstat │
│  Monaco split panes       │   POST /api/v1/chat/contextual-blame     │  radon complexity metrics  │
│  Zustand store            │   GET  /api/v1/health                    │  static import parsing     │
└──────────────────────────┘                                          └───────────┬───────────────┘
                                                                                   │ subprocess
                                                                                   ▼
                                                                        Target Git repository
                                                                        (TARGET_REPO_PATH)
```

- **The FastAPI layer** (`Project101/backend/`) shells out to the native `git`
  binary against the target repository and runs static analysis: cyclomatic
  complexity via **radon**, physical line counts, per-file commit frequency
  from a bulk `git log` pass, and an import graph parsed from Python (`ast`)
  and JS/TS (regex) sources. Results are serialized through strict Pydantic
  schemas.
- **The React UI** (`Project101/`) hydrates a global Zustand store from the
  topology endpoint on boot. Clicking a graph node dispatches `activeFileId`;
  a store subscription middleware catches that mutation and immediately
  fetches `GET /api/v1/file/history?path={activeFileId}`, populating the file
  source, refactor timeline, and sidebar metrics atomically. The chat pane
  packages the active file path with each user message and posts it to the
  contextual-blame endpoint, streaming the markdown reply into the window.
- **Cross-origin communication** works out of the box: the backend enables
  permissive CORS middleware for local development, and the frontend points
  at `http://localhost:8000` by default (overridable with the
  `VITE_API_BASE_URL` environment variable).

## 2. Prerequisites & Environment Setup

| Dependency | Version | Used for |
| --- | --- | --- |
| **Python** | 3.11+ (tested on 3.14) | FastAPI backend, radon metrics |
| **Node.js + npm** | 20+ LTS (tested on v24) | Vite/React frontend |
| **git** | any recent | history, blame, and numstat analysis (must be on `PATH`) |
| Internet access | — | first `npm install` / `pip install`, and Monaco's CDN loader |

Optional:

- `ANTHROPIC_API_KEY` + `pip install anthropic` — upgrades the chat endpoint
  from the built-in deterministic analyst to real LLM answers
  (model defaults to `claude-opus-4-8`, override with `ANTHROPIC_MODEL`).
- `VITE_API_BASE_URL` — point the UI at a non-default backend address.

> **Windows note:** if `npm` is not on `PATH`, prepend a portable Node build
> for the session:
> `$env:Path = "C:\path\to\node-vX.Y.Z-win-x64;$env:Path"`

## 3. Step-by-Step Installation Blueprint

Clone the repository, then initialize both systems.

**Frontend setup**

```bash
cd Project101
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

**Backend setup**

```bash
cd Project101/backend
python -m venv venv
source venv/bin/activate      # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Start the backend with either:

```bash
python main.py                # bootstrap script (validates the target repo, then serves)
# or
uvicorn main:app --reload     # equivalent, with hot reload
```

The API serves on `http://127.0.0.1:8000` — interactive docs at
`http://127.0.0.1:8000/docs`, health probe at `/api/v1/health`.

## 4. Repository Analysis & Operation Instructions

By default the engine analyzes the repository that contains this project.
To audit **any other codebase on your machine**:

**Step 1 — point `TARGET_REPO_PATH` at the codebase you want to audit.**
Set the environment variable to the *absolute* path of the local directory
you wish to analyze. The directory must be the root of a Git repository (the
folder containing `.git`) — the server validates this before starting its
listener loop and aborts the bootstrap sequence with a clear initialization
error if the path is missing or has no `.git` directory.

**Step 2 — launch the target ingestion flow.**

macOS / Linux:

```bash
export TARGET_REPO_PATH="/absolute/path/to/your/target-project"
uvicorn main:app --reload
```

Windows PowerShell:

```powershell
$env:TARGET_REPO_PATH = "C:\absolute\path\to\your\target-project"
uvicorn main:app --reload
```

(Run these from `Project101/backend` with the virtual environment activated.
`python main.py` works identically.)

**Step 3 — explore the processed repository.**
With the backend running and `npm run dev` active, open
**http://localhost:5173** in the browser:

1. **Module graph** — the canvas shows the **10–12 highest-frequency git
   change nodes** (files ranked by total commit count), sized and colored by
   radon cyclomatic complexity, linked by their actual import dependencies.
   Use the filter bar (`.ts`, `src/components`, any path substring) to dim
   non-matching nodes.
2. **File inspector** — click any node: the side panel loads that file's live
   analytics (average commit size, commits per month, line count) and its
   chronological commit timeline straight from `git log --follow`.
3. **Contextual blame chat** — with a file selected, ask the assistant
   questions like *"Who wrote this and why did it change?"* The UI posts the
   file path and your message to `/api/v1/chat/contextual-blame`; the backend
   runs `git blame`, isolates the lines relevant to your question, and the
   markdown reply streams into the chat window with the blame records used.
4. **Editor comparison** — *Open refactor sandbox* on any file to test it in
   the split panes: the raw legacy source on the left (read-only Monaco) and
   the modernizer preview on the right (editable), with a live complexity
   delta and regression-risk analysis alongside.

**Troubleshooting**

- *"Analysis engine unavailable"* in the UI → the backend isn't running or is
  on a different port; start it and press Retry.
- *422 / 404 JSON errors* → the requested path traverses outside the target
  repository or does not exist in it.
- *Startup aborts immediately* → read the initialization error: it means
  `TARGET_REPO_PATH` is not a directory or contains no `.git` folder.
