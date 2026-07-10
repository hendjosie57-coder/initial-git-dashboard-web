"""Schemas for the codebase graph endpoint."""

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str = Field(description="Relative file path (POSIX separators)")
    cyclomaticComplexity: int = Field(ge=0, description="Computed via radon metrics")
    commitFrequencyCount: int = Field(ge=0, description="Total git commits touching this path")
    fileSizeLines: int = Field(ge=0, description="Physical line count")


class GraphLink(BaseModel):
    source: str = Field(description="Source relative file path")
    target: str = Field(description="Target imported relative file path")
    dependencyType: str = Field(default="import")


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]
