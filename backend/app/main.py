"""
Research Paper Analyzer - Backend API
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import health, research

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Reduce noise from libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    
    logger.info("=" * 60)
    logger.info("Starting Research Paper Analyzer Backend")
    logger.info("=" * 60)
    logger.info(f"Engine: {settings.SUBCONSCIOUS_ENGINE}")
    logger.info(f"API Key: {'Configured' if settings.SUBCONSCIOUS_API_KEY else 'MISSING'}")
    logger.info(f"ArXiv Service: {settings.ARXIV_SERVICE_URL or 'Not configured'}")
    logger.info(f"Max Retries: {settings.MAX_RETRIES}")
    logger.info(f"Retry Delay: {settings.RETRY_DELAY}s (exponential backoff)")
    logger.info("=" * 60)
    
    yield
    
    logger.info("Shutting down")


# Create FastAPI application
app = FastAPI(
    title="Research Paper Analyzer API",
    description="AI-powered research paper analysis using Subconscious platform",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS
settings = get_settings()
cors_origins = settings.get_cors_origins_list()
logger.info(f"CORS Origins: {cors_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(research.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Research Paper Analyzer API",
        "version": "2.0.0",
        "docs": "/docs",
    }
