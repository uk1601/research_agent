"""
Health check endpoints for the API with detailed diagnostics.
"""

import logging
from datetime import datetime

from fastapi import APIRouter
from app.config import get_settings
from app.models.schemas import get_analysis_schema

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.
    Returns service status and configuration summary.
    """
    settings = get_settings()
    
    return {
        "status": "healthy",
        "service": "research-paper-analyzer-backend",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "engine": settings.SUBCONSCIOUS_ENGINE,
            "api_key_configured": bool(settings.SUBCONSCIOUS_API_KEY),
            "arxiv_configured": bool(settings.ARXIV_SERVICE_URL),
            "max_retries": settings.MAX_RETRIES,
            "retry_delay": settings.RETRY_DELAY,
            "stream_timeout": settings.STREAM_TIMEOUT,
        }
    }


@router.get("/health/ready")
async def readiness_check():
    """
    Readiness check - verifies configuration is complete.
    Returns detailed configuration status.
    """
    settings = get_settings()
    
    issues = []
    
    if not settings.SUBCONSCIOUS_API_KEY:
        issues.append("SUBCONSCIOUS_API_KEY not configured")
    
    if not settings.ARXIV_SERVICE_URL:
        issues.append("ARXIV_SERVICE_URL not configured (ArXiv search disabled)")
    
    return {
        "status": "ready" if not issues or (len(issues) == 1 and "ARXIV" in issues[0]) else "not_ready",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "engine": settings.SUBCONSCIOUS_ENGINE,
            "api_key_configured": bool(settings.SUBCONSCIOUS_API_KEY),
            "arxiv_url": settings.ARXIV_SERVICE_URL,
            "max_retries": settings.MAX_RETRIES,
            "retry_delay": settings.RETRY_DELAY,
            "stream_timeout": settings.STREAM_TIMEOUT,
            "request_timeout": settings.REQUEST_TIMEOUT,
        },
        "issues": issues if issues else None,
    }


@router.get("/health/live")
async def liveness_check():
    """
    Liveness check - simple endpoint to verify the service is running.
    Used by container orchestration systems.
    """
    return {
        "status": "alive",
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/debug/schema")
async def debug_schema():
    """
    Debug endpoint to view the answerFormat schema being sent to Subconscious.
    Useful for troubleshooting schema validation errors.
    """
    return {
        "answerFormat": get_analysis_schema()
    }
