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
    
    # CORS Configuration - use a plain string to avoid pydantic JSON parsing issues
    # Set as comma-separated: CORS_ORIGINS=https://app.vercel.app,http://localhost:3000
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    def get_cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [
            origin.strip().rstrip('/')  # Remove trailing slashes
            for origin in self.CORS_ORIGINS.split(',') 
            if origin.strip()
        ]
    
    # Retry Configuration for TIM Engine Warmup
    MAX_RETRIES: int = 5
    RETRY_DELAY: float = 10.0
    
    # Timeouts
    REQUEST_TIMEOUT: int = 120
    STREAM_TIMEOUT: int = 300
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


def get_settings() -> Settings:
    """Get settings instance."""
    return Settings()
