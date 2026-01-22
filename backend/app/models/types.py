"""
Type definitions matching Subconscious API response structures.
Based on official documentation at https://docs.subconscious.dev
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict, Union
from enum import Enum


class RunStatus(str, Enum):
    """Possible run statuses from Subconscious API."""
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    TIMED_OUT = "timed_out"


class ToolCall(BaseModel):
    """Tool call information within a task."""
    tool_name: str = Field(..., description="Name of the tool that was called")
    parameters: Any = Field(..., description="Input parameters sent to the tool")
    tool_result: Any = Field(None, description="Result returned by the tool")


class Task(BaseModel):
    """
    A task in the reasoning tree.
    Tasks can be nested via subtasks to form a hierarchical reasoning trace.
    """
    title: Optional[str] = Field(None, description="Descriptive title for this reasoning step")
    thought: Optional[str] = Field(None, description="Agent's internal reasoning")
    tooluse: Optional[ToolCall] = Field(None, description="Tool call details if applicable")
    subtasks: Optional[List['Task']] = Field(None, description="Nested reasoning steps")
    conclusion: Optional[str] = Field(None, description="Conclusion after completing this step")


class RunResult(BaseModel):
    """Result of a completed run."""
    answer: Union[str, Dict[str, Any]] = Field(..., description="Final answer (string or object if using answerFormat)")
    reasoning: Optional[List[Task]] = Field(None, description="Step-by-step reasoning process")


class RunUsage(BaseModel):
    """Token usage information."""
    input_tokens: Optional[int] = Field(None, alias="inputTokens")
    output_tokens: Optional[int] = Field(None, alias="outputTokens")
    duration_ms: Optional[int] = Field(None, alias="durationMs")


class RunError(BaseModel):
    """Error information for failed runs."""
    code: str
    message: str


class RunResponse(BaseModel):
    """Complete response from a Subconscious run."""
    run_id: str = Field(..., alias="runId")
    status: RunStatus
    result: Optional[RunResult] = None
    usage: Optional[RunUsage] = None
    error: Optional[RunError] = None
    
    class Config:
        populate_by_name = True


# Request models

class AnalyzeRequest(BaseModel):
    """Request to analyze a research topic."""
    topic: str = Field(..., min_length=3, max_length=500, description="Research topic to analyze")
    use_structured_output: bool = Field(True, description="Whether to use structured output format")
    include_arxiv: bool = Field(True, description="Whether to include ArXiv search")


class StreamEvent(BaseModel):
    """Server-Sent Event for streaming responses."""
    type: str  # "delta", "done", "error"
    content: Optional[str] = None
    run_id: Optional[str] = None
    answer: Optional[Any] = None
    reasoning: Optional[List[Task]] = None
    error: Optional[str] = None


# Rebuild model to resolve forward references
Task.model_rebuild()
