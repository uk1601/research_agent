"""
Configuration management using Pydantic Settings.
Loads from environment variables and .env file.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Subconscious API Configuration
    SUBCONSCIOUS_API_KEY: str
    SUBCONSCIOUS_ENGINE: str = "tim-gpt"
    SUBCONSCIOUS_BASE_URL: str = "https://api.subconscious.dev/v1"
    
    @field_validator('SUBCONSCIOUS_API_KEY')
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        """Validate that API key is set and not empty."""
        if not v or v.strip() == '' or v == 'your-api-key-here':
            raise ValueError(
                'SUBCONSCIOUS_API_KEY is required. '
                'Get your API key from https://subconscious.dev and set it in .env file.'
            )
        return v.strip()
    
    # ArXiv Tool Service (separate microservice)
    ARXIV_SERVICE_URL: Optional[str] = None
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # CORS Configuration
    # In production, set CORS_ORIGINS environment variable as comma-separated list
    # Example: CORS_ORIGINS=https://your-app.vercel.app,https://your-domain.com
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from comma-separated string or list."""
        if isinstance(v, str):
            # Handle comma-separated string from environment variable
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return v
    
    # Retry Configuration for TIM Engine Warmup
    # TIM engines can take 30-90 seconds to warm up on first use
    # Delay formula: RETRY_DELAY * (2 ^ attempt)
    # With these defaults: 10s, 20s, 40s, 80s, 160s = ~5 min total wait
    MAX_RETRIES: int = 5
    RETRY_DELAY: float = 10.0  # Start with 10 seconds
    
    # Timeouts
    REQUEST_TIMEOUT: int = 120
    STREAM_TIMEOUT: int = 300
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Use a function without caching during development to pick up env changes
def get_settings() -> Settings:
    """Get settings instance (no cache for dev flexibility)."""
    return Settings()
