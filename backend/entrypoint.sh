#!/bin/bash
set -e

# Wait for DB
until uv run python -c "import psycopg; psycopg.connect('postgresql://postgres:postgres@db:5432/finsight')" 2>/dev/null; do
  echo "Waiting for DB..."
  sleep 2
done

echo "Running migrations..."
uv run alembic upgrade head

echo "Seeding demo data..."
uv run python scripts/seed_demo.py

echo "Starting server..."
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000