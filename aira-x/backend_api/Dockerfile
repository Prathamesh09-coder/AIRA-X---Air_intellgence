# ==========================================
# STAGE 1: Builder
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    libpq-dev \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libspatialindex-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Build wheels for all dependencies recursively (no --no-deps)
RUN pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime spatial and database dependencies only
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libspatialindex-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled wheels from builder stage
COPY --from=builder /build/wheels /wheels
COPY requirements.txt .

RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy application files
COPY . .

# Set up non-root security context
RUN groupadd -g 10001 appgroup && \
    useradd -r -u 10001 -g appgroup -d /app -s /sbin/nologin -c "Application User" appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
