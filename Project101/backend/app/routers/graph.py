"""GET /api/v1/graph — full codebase graph (nodes + dependency links)."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter

from app import config
from app.schemas import GraphLink, GraphNode, GraphResponse
from app.services import complexity_service, dependency_service, git_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["graph"])


def _read_source(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _build_nodes_and_links(commit_counts: dict[str, int]) -> GraphResponse:
    nodes: list[GraphNode] = []
    links: list[GraphLink] = []

    for file_path in dependency_service.iter_source_files(config.REPO_ROOT):
        relative = git_service.to_repo_relative(file_path)
        try:
            source = _read_source(file_path)
        except OSError:
            logger.warning("unreadable file skipped: %s", relative)
            continue

        nodes.append(
            GraphNode(
                id=relative,
                cyclomaticComplexity=complexity_service.file_complexity(relative, source),
                commitFrequencyCount=commit_counts.get(relative, 0),
                fileSizeLines=len(source.splitlines()),
            )
        )
        for target in sorted(dependency_service.extract_imports(source, file_path)):
            links.append(
                GraphLink(
                    source=relative,
                    target=git_service.to_repo_relative(target),
                    dependencyType="import",
                )
            )
    return GraphResponse(nodes=nodes, links=links)


@router.get("/repository/topology", response_model=GraphResponse)
@router.get("/graph", response_model=GraphResponse, deprecated=True)
async def get_codebase_graph() -> GraphResponse:
    commit_counts = await git_service.count_commits_per_file()
    # File scanning + parsing is CPU/disk bound: keep it off the event loop.
    return await asyncio.to_thread(_build_nodes_and_links, dict(commit_counts))
