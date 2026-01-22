"""
ArXiv Tool Server - Separate Microservice

This microservice provides ArXiv search capabilities for the Subconscious agent.
It must be deployed to a publicly accessible URL since Subconscious calls it via HTTP.

IMPORTANT: Subconscious sends tool calls in a wrapped format:
{
    "tool_name": "arxiv_search",
    "parameters": {"query": "...", "max_results": 10},
    "request_id": "..."
}

We need to extract the actual parameters from the "parameters" field.

Endpoints:
- POST /search - Search ArXiv papers (called by Subconscious)
- GET /health - Health check
"""

import logging
import json
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import arxiv

# Configure logging - verbose
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="ArXiv Tool Server",
    description="ArXiv search microservice for Subconscious agent integration",
    version="1.0.0",
)

# CORS - allow Subconscious to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Subconscious needs to call this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models

class SearchParameters(BaseModel):
    """The actual search parameters inside the Subconscious wrapper."""
    query: str = Field(..., description="Search query for ArXiv papers")
    max_results: int = Field(10, ge=1, le=50, description="Maximum number of results")
    
    @validator('max_results', pre=True, always=True)
    def coerce_max_results(cls, v):
        """Handle max_results as string or int or missing."""
        if v is None:
            return 10
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return 10
        return v


class SubconsciousToolRequest(BaseModel):
    """
    Request format that Subconscious sends when calling tools.
    
    Subconscious wraps tool calls in this format:
    {
        "tool_name": "arxiv_search",
        "parameters": {"query": "...", "max_results": 10},
        "request_id": "request-..."
    }
    """
    tool_name: Optional[str] = None
    parameters: Optional[dict] = None
    request_id: Optional[str] = None
    
    # Also allow direct parameters for backwards compatibility
    query: Optional[str] = None
    max_results: Optional[int] = 10
    
    class Config:
        extra = "ignore"


class Paper(BaseModel):
    """A paper returned from ArXiv."""
    title: str
    authors: List[str]
    abstract: str
    published: str
    updated: Optional[str] = None
    arxiv_id: str
    url: str
    pdf_url: str
    categories: List[str]
    primary_category: str


class SearchResponse(BaseModel):
    """Response from ArXiv search."""
    papers: List[Paper]
    total: int
    query: str


# Endpoints

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "ArXiv Tool Server",
        "version": "1.0.0",
        "endpoints": {
            "search": "POST /search",
            "health": "GET /health"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "arxiv-tool-server"}


@app.post("/search")
async def search_papers(request: Request):
    """
    Search ArXiv for papers.
    
    This endpoint is called by Subconscious during agent execution.
    Handles both Subconscious wrapped format and direct parameters.
    """
    # ============================================================
    # DEBUG: Log everything about the incoming request
    # ============================================================
    logger.info("=" * 70)
    logger.info("[DEBUG] === INCOMING REQUEST ===")
    logger.info(f"[DEBUG] Headers: {dict(request.headers)}")
    logger.info(f"[DEBUG] Content-Type: {request.headers.get('content-type', 'NOT SET')}")
    
    # Read raw body
    try:
        raw_body = await request.body()
        raw_str = raw_body.decode('utf-8')
        logger.info(f"[DEBUG] Raw body (string): {raw_str}")
        logger.info(f"[DEBUG] Raw body length: {len(raw_str)} bytes")
    except Exception as e:
        logger.error(f"[DEBUG] Failed to read body: {e}")
        raise HTTPException(status_code=400, detail=f"Could not read request body: {e}")
    
    # Parse JSON
    try:
        body = json.loads(raw_str)
        logger.info(f"[DEBUG] Parsed JSON: {body}")
        logger.info(f"[DEBUG] JSON type: {type(body)}")
        if isinstance(body, dict):
            logger.info(f"[DEBUG] JSON keys: {list(body.keys())}")
            for key, value in body.items():
                logger.info(f"[DEBUG]   {key}: {value} (type: {type(value).__name__})")
    except json.JSONDecodeError as e:
        logger.error(f"[DEBUG] JSON parse error: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {e}")
    
    # ============================================================
    # Extract parameters - handle both formats
    # ============================================================
    query = None
    max_results = 10
    
    # Check if this is Subconscious wrapped format
    if "parameters" in body and isinstance(body.get("parameters"), dict):
        logger.info("[DEBUG] Detected Subconscious wrapped format - extracting from 'parameters'")
        params = body["parameters"]
        query = params.get("query")
        max_results = params.get("max_results", 10)
    else:
        # Direct format (backwards compatibility)
        logger.info("[DEBUG] Using direct format")
        query = body.get("query")
        max_results = body.get("max_results", 10)
    
    # Validate
    if not query:
        logger.error("[DEBUG] No query found in request")
        raise HTTPException(status_code=422, detail="Missing 'query' parameter")
    
    # Coerce max_results
    if isinstance(max_results, str):
        try:
            max_results = int(max_results)
        except ValueError:
            max_results = 10
    
    max_results = max(1, min(50, max_results or 10))
    
    logger.info(f"[DEBUG] Extracted parameters:")
    logger.info(f"[DEBUG]   query: '{query}'")
    logger.info(f"[DEBUG]   max_results: {max_results}")
    logger.info("=" * 70)
    
    # ============================================================
    # Actual ArXiv search
    # ============================================================
    logger.info(f"Searching ArXiv for: {query} (max: {max_results})")
    
    try:
        # Create ArXiv search client
        client = arxiv.Client()
        
        # Build search query
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
            sort_order=arxiv.SortOrder.Descending
        )
        
        # Execute search
        papers = []
        for result in client.results(search):
            # Truncate abstract if too long
            abstract = result.summary
            if len(abstract) > 1000:
                abstract = abstract[:1000] + "..."
            
            papers.append(Paper(
                title=result.title,
                authors=[author.name for author in result.authors],
                abstract=abstract,
                published=result.published.isoformat() if result.published else "",
                updated=result.updated.isoformat() if result.updated else None,
                arxiv_id=result.entry_id.split("/")[-1],
                url=result.entry_id,
                pdf_url=result.pdf_url or "",
                categories=list(result.categories),
                primary_category=result.primary_category or ""
            ))
        
        logger.info(f"Found {len(papers)} papers for query: {query}")
        
        response = SearchResponse(
            papers=papers,
            total=len(papers),
            query=query
        )
        
        logger.info(f"[DEBUG] Returning {len(papers)} papers")
        return response
        
    except Exception as e:
        logger.exception(f"ArXiv search failed: {e}")
        # Return empty result instead of error (more graceful for agent)
        return SearchResponse(
            papers=[],
            total=0,
            query=query
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
