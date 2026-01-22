"""
Research analysis API routes.

Architecture Notes:
- Uses sse-starlette for proper SSE streaming with immediate flush
- The event_generator is truly async - doesn't block the event loop
- The SubconsciousService.stream_async() runs SDK in a thread pool

Key Design Decisions:
1. Async generator pattern: event_generator() is async and yields immediately
2. Thread pool: Sync SDK runs in ThreadPoolExecutor, events flow via Queue
3. Non-blocking: asyncio.to_thread() and queue.get() with timeouts
4. Clean shutdown: Proper cancellation and resource cleanup
"""

import json
import logging
from datetime import datetime
from typing import List, Optional, AsyncGenerator

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.services.subconscious import (
    get_subconscious_service, 
    get_available_engines, 
    get_available_tools
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/research", tags=["research"])


class AnalyzeRequest(BaseModel):
    """Request body for analysis endpoints."""
    topic: str = Field(..., min_length=3, max_length=2000, description="Research topic or question")
    engine: Optional[str] = Field(None, description="Engine to use (e.g., tim-gpt, tim-small-preview, tim-large)")
    tools: Optional[List[str]] = Field(None, description="List of tool IDs to use (web_search, webpage_understanding, exa_search)")
    include_arxiv: bool = Field(True, description="Whether to include ArXiv academic paper search")


@router.get("/engines")
async def list_engines():
    """Get list of available research engines."""
    return {"engines": get_available_engines()}


@router.get("/tools")
async def list_tools():
    """Get list of available platform tools."""
    return {"tools": get_available_tools()}


@router.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    """
    Streaming research analysis endpoint.
    
    Returns a Server-Sent Events (SSE) stream with research progress and results.
    
    Event Types:
    - status: Progress updates (phases: init, connecting, researching, retry, finalizing, complete)
    - activity: Research activity logs with delta information
    - done: Final results with answer and reasoning
    - error: Error messages
    
    The stream uses sse-starlette for proper event flushing without buffering delays.
    The backend runs the sync Subconscious SDK in a thread pool to avoid blocking
    the async event loop, ensuring immediate event delivery to clients.
    """
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    logger.info("=" * 80)
    logger.info(f"[ROUTE] NEW STREAM REQUEST at {timestamp}")
    logger.info("=" * 80)
    logger.info(f"[ROUTE] Topic: {request.topic[:100]}{'...' if len(request.topic) > 100 else ''}")
    logger.info(f"[ROUTE] Engine: {request.engine or 'default'}")
    logger.info(f"[ROUTE] Tools: {request.tools or 'all'}")
    logger.info(f"[ROUTE] Include ArXiv: {request.include_arxiv}")
    
    async def event_generator() -> AsyncGenerator[dict, None]:
        """
        Async generator that yields SSE events.
        
        This generator:
        1. Creates a SubconsciousService instance
        2. Calls stream_async() which runs the SDK in a thread pool
        3. Yields events immediately as they arrive (non-blocking)
        4. Handles cleanup on cancellation or error
        """
        event_count = 0
        delta_count = 0
        start_time = datetime.now()
        
        try:
            service = get_subconscious_service(engine=request.engine)
            
            logger.info(f"[ROUTE] Starting async stream iteration...")
            
            # Use the async streaming method - this doesn't block!
            async for event in service.stream_async(
                topic=request.topic,
                engine=request.engine,
                tool_ids=request.tools,
                include_arxiv=request.include_arxiv
            ):
                event_count += 1
                event_type = event.get("type", "unknown")
                elapsed = (datetime.now() - start_time).total_seconds()
                
                # Detailed logging for debugging
                if event_type == "delta":
                    delta_count += 1
                    if delta_count <= 5 or delta_count % 20 == 0:
                        content_len = len(str(event.get("content", "")))
                        logger.info(f"[ROUTE] Event #{event_count} [{elapsed:.1f}s] DELTA #{delta_count} ({content_len} chars)")
                elif event_type == "activity":
                    delta_num = event.get("delta_count", 0)
                    content_type = event.get("content_type", "?")
                    if delta_num <= 5 or delta_num % 20 == 0:
                        logger.info(f"[ROUTE] Event #{event_count} [{elapsed:.1f}s] ACTIVITY #{delta_num} ({content_type})")
                elif event_type == "status":
                    phase = event.get("phase", "?")
                    message = event.get("message", "")[:50]
                    logger.info(f"[ROUTE] Event #{event_count} [{elapsed:.1f}s] STATUS/{phase}: {message}")
                elif event_type == "done":
                    run_id = event.get("run_id", "?")
                    answer = event.get("answer")
                    answer_type = type(answer).__name__
                    answer_len = len(str(answer)) if answer else 0
                    reasoning_len = len(event.get("reasoning", []))
                    logger.info(f"[ROUTE] Event #{event_count} [{elapsed:.1f}s] DONE: run_id={run_id}, answer={answer_type}({answer_len} chars), reasoning={reasoning_len} steps")
                elif event_type == "error":
                    error = event.get("error", "?")
                    logger.error(f"[ROUTE] Event #{event_count} [{elapsed:.1f}s] ERROR: {error}")
                
                # Yield event data - sse-starlette handles formatting and flushing
                yield {"data": json.dumps(event)}
            
            # Stream complete
            total_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"[ROUTE] Stream iteration complete")
            logger.info(f"[ROUTE]   Total events: {event_count}")
            logger.info(f"[ROUTE]   Total deltas: {delta_count}")
            logger.info(f"[ROUTE]   Total time: {total_time:.1f}s")
            
            # Send done signal
            yield {"data": "[DONE]"}
            logger.info(f"[ROUTE] Sent [DONE] signal")
            
        except GeneratorExit:
            logger.warning("[ROUTE] Client disconnected (GeneratorExit)")
            raise
        except Exception as e:
            logger.exception(f"[ROUTE] Generator exception: {e}")
            yield {"data": json.dumps({"type": "error", "error": str(e)})}
            yield {"data": "[DONE]"}
    
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/health")
async def health_check():
    """Health check endpoint for the research API."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "engines": len(get_available_engines()),
        "tools": len(get_available_tools()),
    }
