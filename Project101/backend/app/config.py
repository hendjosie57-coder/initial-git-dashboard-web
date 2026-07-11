"""Runtime configuration for the analysis engine.

Everything is overridable through environment variables so the server can be
pointed at any local Git repository without code changes.
"""

from __future__ import annotations

import os
from pathlib import Path


def _discover_repo_root() -> Path:
    """Resolve the repository under analysis.

    Priority: `TARGET_REPO_PATH` (the ingestion target), then the legacy
    `GIT_REPO_PATH` alias, then walking upward from this file until a
    directory containing `.git` is found (the backend ships inside the
    repository it analyses by default).
    """
    override = os.getenv("TARGET_REPO_PATH") or os.getenv("GIT_REPO_PATH")
    if override:
        return Path(override).expanduser().resolve()

    current = Path(__file__).resolve().parent
    for candidate in (current, *current.parents):
        if (candidate / ".git").exists():
            return candidate
    # Last resort: current working directory (rejected by startup validation
    # below unless it actually is a git repository).
    return Path.cwd().resolve()


REPO_ROOT: Path = _discover_repo_root()


def validate_target_repository() -> None:
    """Abort the bootstrap sequence unless REPO_ROOT is a real git repository.

    Called before the FastAPI listener loop starts; raising here stops the
    server from serving requests against a directory it cannot analyse.
    """
    if not REPO_ROOT.is_dir():
        raise RuntimeError(
            f"TARGET_REPO_PATH initialization error: {REPO_ROOT} is not a directory. "
            "Set TARGET_REPO_PATH to the absolute path of a local git repository."
        )
    if not (REPO_ROOT / ".git").exists():
        raise RuntimeError(
            f"TARGET_REPO_PATH initialization error: {REPO_ROOT} contains no .git "
            "directory. Point TARGET_REPO_PATH at the root of a git repository "
            "(the folder that holds .git)."
        )

# Directories never scanned for graph nodes or dependency links.
EXCLUDED_DIRS: frozenset[str] = frozenset(
    {
        ".git",
        "node_modules",
        "dist",
        "build",
        "coverage",
        "__pycache__",
        ".venv",
        "venv",
        ".next",
        ".idea",
        ".vscode",
    }
)

# Source extensions included in the codebase graph.
SOURCE_EXTENSIONS: frozenset[str] = frozenset(
    {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
)

# JS/TS extension resolution order for import specifiers without extensions.
JS_RESOLUTION_EXTENSIONS: tuple[str, ...] = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")

# --- Optional LLM integration (chat endpoint) --------------------------------
ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY") or None
ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8")

# --- Server -------------------------------------------------------------------
HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
