# Git Codebase Analysis Dashboard — Backend

FastAPI data engine that analyses a local Git repository: radon complexity
metrics, commit frequency, a static dependency graph, per-file history
analytics, and a contextual `git blame` chat endpoint.

## Setup

```powershell
cd Project101/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py            # serves http://127.0.0.1:8000 (docs at /docs)
```

By default the server analyses the Git repository that contains this folder.
Point it elsewhere with `GIT_REPO_PATH=C:\path\to\repo`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/graph` | Codebase graph: `{nodes, links}` — complexity, commit counts, LOC, import links |
| GET | `/api/v1/file/history?path=<relative>` | Raw + modernized source, analytics, chronological refactor timeline |
| POST | `/api/v1/chat/contextual-blame` | `{targetFilePath, userInquiry}` → markdown reply + blame records used |
| GET | `/api/v1/health` | Repo path + whether the LLM integration is active |

## Error semantics

Errors return JSON `{"error", "detail"}`:

- `404 file_not_found` — path does not exist inside the repository
- `422 unprocessable_path` — empty path or `../` traversal outside the repo
- `500 git_unavailable` / `git_command_failed` — git binary missing or a git command failed

## Notes on metrics

- **cyclomaticComplexity** — Python files: sum of radon block complexities
  (`radon.complexity.cc_visit`). JS/TS files: documented decision-point
  approximation (radon only parses Python).
- **commitFrequencyCount** — computed in one bulk `git log --name-only` pass.
- **averageCommitSizeLines** — mean of additions + deletions per commit from
  `git log --follow --numstat`.
- **commitFrequencyPerMonth** — commits divided by the file's active lifespan
  in months (minimum one month).

## Optional LLM chat

The chat endpoint ships with a deterministic mock analyst. To enable real
LLM answers install the Anthropic SDK and export a key:

```powershell
pip install anthropic
$env:ANTHROPIC_API_KEY = "sk-ant-..."
# optional override, defaults to claude-opus-4-8
$env:ANTHROPIC_MODEL = "claude-opus-4-8"
```
