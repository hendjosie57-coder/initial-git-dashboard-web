"""Runtime configuration for the analysis engine.

Everything is overridable through environment variables so the server can be
pointed at any local Git repository without code changes.
"""

from __future__ import annotations

import os
from pathlib import Path


def _discover_repo_root() -> Path:
    """Walk upward from this file until a directory containing `.git` is found.

    The backend ships inside the repository it analyses by default, so this
    gives a sensible zero-config default. `GIT_REPO_PATH` overrides it.
    """
    override = os.getenv("GIT_REPO_PATH")
    if override:
        return Path(override).expanduser().resolve()

    current = Path(__file__).resolve().parent
    for candidate in (current, *current.parents):
        if (candidate / ".git").exists():
            return candidate
    # Last resort: current working directory (validated again at request time).
    return Path.cwd().resolve()


REPO_ROOT: Path = _discover_repo_root()

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
