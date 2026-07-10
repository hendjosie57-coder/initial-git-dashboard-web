"""Schemas for the contextual blame chat endpoint."""

from pydantic import BaseModel, Field


class ContextualBlameRequest(BaseModel):
    targetFilePath: str = Field(min_length=1, description="Relative path of the file to inspect")
    userInquiry: str = Field(min_length=1, description="The user's question about the code history")


class BlameLineEntry(BaseModel):
    lineIndex: int = Field(ge=1)
    authorName: str
    commitHash: str
    commitMessage: str
    sourceLineContent: str


class ContextualBlameResponse(BaseModel):
    replyText: str = Field(description="Markdown formatted answer")
    parsedBlameUsed: list[BlameLineEntry]
