#!/bin/bash
set -e

echo "Waiting for database..."
until uv run python -c "
import os, psycopg
url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/finsight')
psycopg.connect(url).close()
print('DB ready')
"; do
  sleep 2
done

echo "Running migrations..."
uv run alembic upgrade head

echo "Seeding demo data..."
uv run python app/scripts/seed_demo.py || echo "Seed skipped (already seeded or error)"

echo "Starting server..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000