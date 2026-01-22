# ArXiv Tool Server - Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Create non-root user
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Railway assigns PORT dynamically - don't hardcode
# EXPOSE is just documentation, Railway ignores it
EXPOSE 8001

# Health check - use the PORT env var that Railway sets
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

# Run the application - USE $PORT from Railway!
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}
