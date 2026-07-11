"""POST /api/v1/chat/contextual-blame — history Q&A grounded in git blame."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import BlameLineEntry, ContextualBlameRequest, ContextualBlameResponse
from app.services import chat_service, git_service

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post("/chat/contextual-blame", response_model=ContextualBlameResponse)
async def contextual_blame(request: ContextualBlameRequest) -> ContextualBlameResponse:
    absolute = git_service.resolve_repo_path(request.targetFilePath)
    relative = git_service.to_repo_relative(absolute)

    blame = await git_service.blame_file(relative)
    context = chat_service.select_relevant_lines(blame, request.userInquiry)
    reply = await chat_service.answer(relative, request.userInquiry, context, request.quickAction)

    return ContextualBlameResponse(
        replyText=reply,
        parsedBlameUsed=[
            BlameLineEntry(
                lineIndex=line.line_index,
                authorName=line.author_name,
                commitHash=line.commit_hash,
                commitMessage=line.commit_message,
                sourceLineContent=line.content,
            )
            for line in context
        ],
    )
