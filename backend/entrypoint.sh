#!/bin/bash
set -e

# Wait for DB with full error visibility
python3 <<EOF
import os, sys, time, socket
host, port = "db", 5432
print(f"Checking {host}:{port}...")
for i in range(30):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("TCP Port Open.")
            break
    except:
        print(f"  waiting for {host}:{port}... ({i+1}/30)")
        time.sleep(2)
else:
    print("DB Port never opened. Exiting.")
    sys.exit(1)
EOF

echo "DB port is open. Proceeding to migrations..."

echo "Running migrations..."
uv run alembic upgrade head

echo "Seeding demo data..."
uv run python -m app.scripts.seed_demo || echo "Seed skipped (already seeded or error)"

echo "Starting server..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000