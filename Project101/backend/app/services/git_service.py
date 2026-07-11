"""Asynchronous git plumbing.

All git access goes through :func:`run_git`, which executes the native binary in
a worker thread (safe on every platform/event-loop combination) and converts
failures into typed exceptions that the API layer maps onto HTTP status codes.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from app import config

logger = logging.getLogger(__name__)

# ASCII unit separator — cannot appear in commit metadata, safe field delimiter.
_SEP = "\x1f"


# --- Exceptions (mapped to HTTP responses in main.py) --------------------------


class GitBinaryMissingError(RuntimeError):
    """The `git` executable is not on PATH."""


class GitCommandError(RuntimeError):
    """A git command exited non-zero."""

    def __init__(self, args: list[str], returncode: int, stderr: str) -> None:
        self.args_used = args
        self.returncode = returncode
        self.stderr = stderr.strip()
        super().__init__(f"git {' '.join(args)} failed ({returncode}): {self.stderr}")


class PathOutsideRepositoryError(ValueError):
    """The requested path escapes the repository root (e.g. `../` traversal)."""


class FileNotFoundInRepoError(FileNotFoundError):
    """The requested path does not exist inside the repository."""


# --- Core runner ----------------------------------------------------------------


def _run_git_sync(args: list[str]) -> str:
    try:
        completed = subprocess.run(
            ["git", "-c", "core.quotepath=false", *args],
            cwd=config.REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
    except FileNotFoundError as exc:
        raise GitBinaryMissingError("git binary not found on PATH") from exc
    if completed.returncode != 0:
        raise GitCommandError(args, completed.returncode, completed.stderr)
    return completed.stdout


async def run_git(*args: str) -> str:
    """Run a git command against the configured repository, off the event loop."""
    return await asyncio.to_thread(_run_git_sync, list(args))


async def current_branch() -> str:
    """Name of the checked-out branch (or 'HEAD' when detached)."""
    try:
        return (await run_git("rev-parse", "--abbrev-ref", "HEAD")).strip()
    except GitCommandError:
        return "HEAD"


# --- Path safety ----------------------------------------------------------------


def resolve_repo_path(relative_path: str, must_exist: bool = True) -> Path:
    """Resolve a user-supplied relative path safely inside the repository.

    Raises PathOutsideRepositoryError for traversal attempts and
    FileNotFoundInRepoError when the target is missing.
    """
    cleaned = relative_path.strip().replace("\\", "/").lstrip("/")
    if not cleaned:
        raise PathOutsideRepositoryError("empty path")

    candidate = (config.REPO_ROOT / cleaned).resolve()
    try:
        candidate.relative_to(config.REPO_ROOT)
    except ValueError as exc:
        raise PathOutsideRepositoryError(
            f"path {relative_path!r} resolves outside the repository"
        ) from exc

    if must_exist and not candidate.is_file():
        raise FileNotFoundInRepoError(f"no such file in repository: {relative_path!r}")
    return candidate


def to_repo_relative(path: Path) -> str:
    """Repository-relative POSIX path — the canonical node id format."""
    return path.resolve().relative_to(config.REPO_ROOT).as_posix()


# --- Bulk commit counting (graph endpoint) ---------------------------------------


async def count_commits_per_file() -> Counter[str]:
    """Total commits touching each path, in one `git log` pass.

    Far faster than per-file `git log --follow` across a whole repository.
    """
    try:
        output = await run_git("log", "--pretty=format:", "--name-only")
    except GitCommandError as exc:
        # Repository with no commits yet — an empty graph beats a 500.
        logger.warning("bulk commit count unavailable: %s", exc.stderr)
        return Counter()

    counts: Counter[str] = Counter()
    for line in output.splitlines():
        line = line.strip()
        if line:
            counts[line] += 1
    return counts


# --- Per-file history -------------------------------------------------------------


@dataclass(frozen=True)
class CommitLogEntry:
    commit_hash: str
    date: str  # YYYY-MM-DD
    author: str
    summary: str


async def file_commit_log(repo_relative: str) -> list[CommitLogEntry]:
    """`git log --follow` for a single file, oldest → newest."""
    output = await run_git(
        "log",
        "--follow",
        "--date=short",
        f"--pretty=format:%H{_SEP}%ad{_SEP}%an{_SEP}%s",
        "--",
        repo_relative,
    )
    entries: list[CommitLogEntry] = []
    for line in output.splitlines():
        parts = line.split(_SEP, 3)
        if len(parts) == 4:
            entries.append(CommitLogEntry(*parts))
    entries.reverse()  # git emits newest first; the timeline is chronological
    return entries


@dataclass(frozen=True)
class CommitSizeEntry:
    commit_hash: str
    date_iso: str
    additions: int
    deletions: int


async def file_numstat(repo_relative: str) -> list[CommitSizeEntry]:
    """Per-commit line additions/deletions for one file (`--numstat`)."""
    output = await run_git(
        "log",
        "--follow",
        "--numstat",
        f"--pretty=format:@{_SEP}%H{_SEP}%aI",
        "--",
        repo_relative,
    )
    entries: list[CommitSizeEntry] = []
    current: tuple[str, str] | None = None
    for line in output.splitlines():
        if line.startswith(f"@{_SEP}"):
            _, commit_hash, date_iso = line.split(_SEP, 2)
            current = (commit_hash, date_iso)
            continue
        parts = line.split("\t")
        if current and len(parts) == 3:
            adds, dels = parts[0], parts[1]
            entries.append(
                CommitSizeEntry(
                    commit_hash=current[0],
                    date_iso=current[1],
                    # Binary files report "-": count as zero line churn.
                    additions=int(adds) if adds.isdigit() else 0,
                    deletions=int(dels) if dels.isdigit() else 0,
                )
            )
    return entries


# --- Blame -------------------------------------------------------------------------


@dataclass(frozen=True)
class BlameLine:
    line_index: int  # 1-based line number in the current file
    author_name: str
    commit_hash: str
    commit_message: str
    content: str


async def blame_file(repo_relative: str) -> list[BlameLine]:
    """Parse `git blame --line-porcelain` into one record per line."""
    output = await run_git("blame", "--line-porcelain", "--", repo_relative)

    lines: list[BlameLine] = []
    commit_hash = ""
    line_no = 0
    author = "Unknown"
    summary = ""
    for raw in output.splitlines():
        if raw.startswith("\t"):
            # Content line terminates one porcelain record.
            lines.append(
                BlameLine(
                    line_index=line_no,
                    author_name=author,
                    commit_hash=commit_hash,
                    commit_message=summary,
                    content=raw[1:],
                )
            )
            continue
        head, _, rest = raw.partition(" ")
        if len(head) == 40 and all(c in "0123456789abcdef" for c in head):
            commit_hash = head
            fields = rest.split()
            line_no = int(fields[1]) if len(fields) >= 2 else line_no + 1
        elif head == "author":
            author = rest
        elif head == "summary":
            summary = rest
    return lines
