"""Schemas for the granular file history endpoint."""

from pydantic import BaseModel, Field


class FileAnalytics(BaseModel):
    commitFrequencyPerMonth: float = Field(ge=0)
    averageCommitSizeLines: int = Field(ge=0)


class RefactorTimelineEntry(BaseModel):
    commitHash: str
    dateString: str = Field(description="YYYY-MM-DD")
    author: str
    summary: str


class FileHistoryResponse(BaseModel):
    filePath: str
    rawLegacyString: str
    modernizedString: str
    analytics: FileAnalytics
    refactorTimeline: list[RefactorTimelineEntry]
