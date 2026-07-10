"""GET /api/v1/file/history — granular history for the workbench split-panes."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from app.schemas import FileAnalytics, FileHistoryResponse, RefactorTimelineEntry
from app.services import git_service, modernizer_service

router = APIRouter(prefix="/api/v1", tags=["file"])

_AVG_DAYS_PER_MONTH = 30.44


def _commit_frequency_per_month(log: list[git_service.CommitLogEntry]) -> float:
    """Commits per month over the file's active lifespan (oldest → newest)."""
    if not log:
        return 0.0
    first = date.fromisoformat(log[0].date)
    last = date.fromisoformat(log[-1].date)
    months = max((last - first).days / _AVG_DAYS_PER_MONTH, 1.0)
    return round(len(log) / months, 2)


def _average_commit_size(numstat: list[git_service.CommitSizeEntry]) -> int:
    """Average lines added + deleted per commit (the commit size delta)."""
    if not numstat:
        return 0
    total = sum(entry.additions + entry.deletions for entry in numstat)
    return round(total / len(numstat))


@router.get("/file/history", response_model=FileHistoryResponse)
async def get_file_history(
    path: str = Query(min_length=1, description="Relative route to the file"),
) -> FileHistoryResponse:
    absolute = git_service.resolve_repo_path(path)
    relative = git_service.to_repo_relative(absolute)

    raw = absolute.read_text(encoding="utf-8", errors="replace")
    log = await git_service.file_commit_log(relative)
    numstat = await git_service.file_numstat(relative)

    return FileHistoryResponse(
        filePath=relative,
        rawLegacyString=raw,
        modernizedString=modernizer_service.modernize(relative, raw),
        analytics=FileAnalytics(
            commitFrequencyPerMonth=_commit_frequency_per_month(log),
            averageCommitSizeLines=_average_commit_size(numstat),
        ),
        refactorTimeline=[
            RefactorTimelineEntry(
                commitHash=entry.commit_hash,
                dateString=entry.date,
                author=entry.author,
                summary=entry.summary,
            )
            for entry in log
        ],
    )
