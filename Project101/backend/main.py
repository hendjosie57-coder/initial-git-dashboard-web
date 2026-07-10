"""Entrypoint for the Git Codebase Analysis Dashboard data engine.

Run directly (`python main.py`) or via uvicorn (`uvicorn main:app --reload`).
"""

from __future__ import annotations

import logging

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.routers import chat, graph, history
from app.services.git_service import (
    FileNotFoundInRepoError,
    GitBinaryMissingError,
    GitCommandError,
    PathOutsideRepositoryError,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(
    title="Git Codebase Analysis Dashboard API",
    description="Automated data engine: git history, radon complexity metrics, "
    "dependency graph, and contextual blame chat.",
    version="1.0.0",
)

# CORS wide open for local development (Vite dev server, previews, etc.).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router)
app.include_router(history.router)
app.include_router(chat.router)


# --- Error protection: domain exceptions → meaningful JSON responses -----------


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "detail": message})


@app.exception_handler(FileNotFoundInRepoError)
async def _missing_file(_: Request, exc: FileNotFoundInRepoError) -> JSONResponse:
    return _error(404, "file_not_found", str(exc))


@app.exception_handler(PathOutsideRepositoryError)
async def _bad_path(_: Request, exc: PathOutsideRepositoryError) -> JSONResponse:
    return _error(422, "unprocessable_path", str(exc))


@app.exception_handler(GitBinaryMissingError)
async def _no_git(_: Request, exc: GitBinaryMissingError) -> JSONResponse:
    return _error(500, "git_unavailable", str(exc))


@app.exception_handler(GitCommandError)
async def _git_failed(_: Request, exc: GitCommandError) -> JSONResponse:
    return _error(500, "git_command_failed", str(exc))


@app.get("/api/v1/health", tags=["meta"])
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "repository": str(config.REPO_ROOT),
        "llmEnabled": bool(config.ANTHROPIC_API_KEY),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
