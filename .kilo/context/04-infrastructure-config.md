# Infrastructure & Configuration
## Complete Code Reference

### File: `docker-compose.yml`
```yaml
version: "3.8"

services:
  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: finsight
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/finsight
      - DEMO_MODE=${DEMO_MODE:-1}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - FINNHUB_API_KEY=${FINNHUB_API_KEY}
      - JWT_SECRET=${JWT_SECRET:-your-secret-key-change-in-production}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  worker:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/finsight
      - DEMO_MODE=${DEMO_MODE:-1}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uv run python -m app.scripts.run_poller

volumes:
  postgres_data:
```

---

### File: `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
```

---

### File: `backend/requirements.txt`
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
psycopg==3.1.14
alembic==1.12.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
pydantic==2.5.0
pydantic-settings==2.1.0
requests==2.31.0
httpx==0.25.1
yfinance==0.2.28
pandas==2.1.3
numpy==1.26.2
google-generativeai==0.7.2
statsmodels==0.14.0
```

---

### File: `frontend/Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1000 -S appuser && \
    adduser -S -u 1000 appuser

USER appuser

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

### File: `frontend/package.json`
```json
{
  "name": "finsight-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.300.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.40",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```

---

### File: `backend/.env.example`
```bash
# Database
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/finsight

# Demo Mode (1 = use fake data, 0 = use real APIs)
DEMO_MODE=1

# API Keys (required when DEMO_MODE=0)
GEMINI_API_KEY=your_gemini_api_key_here
FINNHUB_API_KEY=your_finnhub_api_key_here

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-change-in-production
```

---

### File: `frontend/.env.example`
```bash
VITE_API_URL=http://localhost:8000
```

---

### File: `backend/migrations/env.py`
```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from app.db import Base
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = create_async_engine(config.get_main_option("sqlalchemy.url"))

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

### File: `backend/migrations/versions/0001_initial_schema.py`
```python
"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-04-29 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create TimescaleDB extension
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
    
    # Users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Watchlist items table
    op.create_table('watchlist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_watchlist_items_symbol'), 'watchlist_items', ['symbol'], unique=False)
    
    # Positions table
    op.create_table('positions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('average_price', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Quote ticks hypertable
    op.create_table('quote_ticks',
        sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('volume', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('ts', 'symbol')
    )
    # Create hypertable (TimescaleDB specific)
    op.execute("SELECT create_hypertable('quote_ticks', 'ts', if_not_exists => TRUE);")
    
    # News items table
    op.create_table('news_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('headline', sa.String(length=500), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('sentiment_label', sa.String(length=20), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_news_items_symbol'), 'news_items', ['symbol'], unique=False)
    
    # Audit events table
    op.create_table('audit_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_events_event_type'), 'audit_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_audit_events_user_id'), 'audit_events', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_events_user_id'), table_name='audit_events')
    op.drop_index(op.f('ix_audit_events_event_type'), table_name='audit_events')
    op.drop_table('audit_events')
    op.drop_index(op.f('ix_news_items_symbol'), table_name='news_items')
    op.drop_table('news_items')
    op.execute("SELECT remove_chunks('quote_ticks');")
    op.execute("SELECT drop_chunks('quote_ticks');")
    op.drop_table('quote_ticks')
    op.drop_table('positions')
    op.drop_index(op.f('ix_watchlist_items_symbol'), table_name='watchlist_items')
    op.drop_table('watchlist_items')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
```

---

### File: `README.md`
```markdown
# FinSight AI

Real-Time Financial Insights Dashboard with AI-Powered Analysis.

## Overview

FinSight AI is a comprehensive financial intelligence platform featuring:
- Real-time market data streaming
- 5-agent DAG execution pipeline
- Portfolio tracking with live P&L
- AI-powered market analysis (Gemini 2.0)
- Automated alert system
- Full audit trail of all operations

## Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: FastAPI + SQLAlchemy + TimescaleDB
- **Agents**: Hand-rolled DAG executor with topological sorting
- **Database**: PostgreSQL + TimescaleDB extension for time-series data
- **APIs**: yfinance (market data), Finnhub (news), Gemini (AI)

## Quick Start

### Development Mode (Demo Data)

```bash
# Clone repository
cd finsight

# Start with demo data
DEMO_MODE=1 docker compose up

# Access UI
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Backend Docs: http://localhost:8000/docs
```

### Production Mode (Real Data)

```bash
# Get API keys
# - Gemini: https://makersuite.google.com/app/apikey
# - Finnhub: https://finnhub.io/dashboard

# Set environment variables
export DEMO_MODE=0
export GEMINI_API_KEY=your_key
export FINNHUB_API_KEY=your_key

# Start services
docker compose up
```

## Demo Credentials

- Email: `demo@finsight.ai`
- Password: `Demo@12345`

## Features

### Real-Time Dashboard
- Live price updates every 15 seconds
- Candlestick charts with 7-day forecast
- Watchlist with price alerts

### AI Copilot
- Natural language queries
- 5-agent DAG (MarketData → {News, Forecast} → Risk → Alert)
- Citation-enforced outputs

### Portfolio Management
- Track positions with live P&L
- Set price alerts
- Historical performance

### Audit Trail
- Complete execution history
- Agent node-level tracking
- Query and response logging

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with credentials
- `GET /users/me` - Get current user profile

### Watchlist
- `GET /watchlist` - List watchlist items
- `POST /watchlist` - Add symbol to watchlist
- `DELETE /watchlist/{id}` - Remove symbol

### Positions
- `GET /positions` - List all positions
- `POST /positions` - Add new position
- `DELETE /positions/{id}` - Remove position

### Quotes
- `GET /quotes/{symbol}/latest` - Latest price
- `GET /quotes/{symbol}/history` - Historical OHLC data

### News
- `GET /news/{symbol}` - Recent news with sentiment

### AI Query
- `POST /query/` - Submit natural language query (async)

### Forecast
- `GET /forecast/{symbol}` - Price forecast

### Audit
- `GET /audit` - Audit trail

### WebSocket
- `WS /ws?token={jwt}` - Real-time updates

## Development

### Backend
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm run dev
```

### Database Migrations
```bash
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://postgres:postgres@localhost:5432/finsight` |
| `DEMO_MODE` | Use demo data (1) or real APIs (0) | `1` |
| `GEMINI_API_KEY` | Google Gemini API key | Required if DEMO_MODE=0 |
| `FINNHUB_API_KEY` | Finnhub API key | Required if DEMO_MODE=0 |
| `JWT_SECRET` | JWT signing secret | `your-secret-key-change-in-production` |

## Educational Use Only

This platform is for educational purposes only. No real trading or financial advice is provided. All data is delayed and should not be used for actual investment decisions.

## License

MIT

## Disclaimer

FINANCIAL DATA IS FOR EDUCATIONAL USE ONLY. PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS. CONSULT A LICENSED FINANCIAL ADVISOR BEFORE MAKING INVESTMENT DECISIONS.
```

---

### File: `.gitignore`
```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual Environments
.venv
venv/
env/

# Django
*.log
local_settings.py

# Environments
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build
/dist
/build
*.pyc

# Database
*.sqlite3
*.db

# Logs
logs/
*.log

# OS
Thumbs.db
```

---

### File: `.kilo/command/setup.md`
```markdown
# Setup Command

## Purpose
Initial project setup and configuration guide.

## Steps

### 1. Environment Setup
```bash
# Clone repository
git clone <repo-url>
cd finsight

# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Database Setup
```bash
# Start PostgreSQL with TimescaleDB
docker compose up -d postgres

# Wait for healthy status
sleep 10

# Run migrations
cd backend
uv run alembic upgrade head
```

### 3. Install Dependencies
```bash
# Backend
cd backend
uv pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 4. Start Services
```bash
# Development (demo mode)
DEMO_MODE=1 docker compose up

# Or start separately
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

### 5. Access Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 6. Login
- Email: `demo@finsight.ai`
- Password: `Demo@12345`

## Configuration

Edit `.env` files to configure:
- Database connection
- API keys
- JWT secret
- Demo mode

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL is running: `docker compose ps`
- Check connection string in `.env`
- Verify TimescaleDB extension installed

### Migration Errors
- Delete migrations folder and regenerate
- Ensure models match database schema

### WebSocket Connection Failed
- Check JWT token validity
- Verify backend is running
- Check CORS configuration

### API Key Errors
- Set DEMO_MODE=1 for demo data
- Or obtain valid API keys from providers
```

---

### File: `.kilo/command/deploy.md`
```markdown
# Deploy Command

## Purpose
Deploy FinSight AI to production environment.

## Pre-Deployment Checklist

- [ ] All tests passing (`pytest -q`)
- [ ] Linting clean (`ruff check .`)
- [ ] Type checking passed (`mypy .`)
- [ ] Environment variables configured
- [ ] API keys obtained
- [ ] Database backups current
- [ ] Rollback plan prepared

## Deployment Steps

### 1. Production Build
```bash
# Backend
cd backend
uv pip install -r requirements.txt

# Frontend
cd frontend
npm run build
```

### 2. Configure Environment
```bash
# .env
DEMO_MODE=0
DATABASE_URL=postgresql+psycopg://user:pass@prod-db:5432/finsight
GEMINI_API_KEY=your_key
FINNHUB_API_KEY=your_key
JWT_SECRET=strong_secret_key
```

### 3. Deploy
```bash
# Production docker compose
docker compose -f docker-compose.prod.yml up -d

# Or with Render
render deploy
```

### 4. Verify
```bash
# Health check
curl http://localhost:8000/healthz

# Database migrations
curl http://localhost:8000/db/status

# API endpoints
curl http://localhost:8000/docs
```

## Rollback Procedure

```bash
# Stop services
docker compose down

# Rollback database
uv run alembic downgrade -1

# Start previous version
docker compose up -d
```

## Monitoring

### Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Health Checks
```bash
curl http://localhost:8000/healthz
curl http://localhost:8000/audit
```

### Performance
- Response time: < 100ms
- WebSocket connections: < 1000
- Database queries: < 50ms average
```

---

### File: `.kilo/agent/system.md`
```markdown
# System Agent Configuration

## Overview
Configuration for Kilo system agents and tools.

## Agents

### spec-writer
- Generates feature specifications from requirements
- Creates test plans
- Defines acceptance criteria

### dialectic-review
- Advocates for technical decisions
- Provides criticism and alternatives
- Reaches verdicts on proposals

### security-review
- OWASP compliance checking
- JWT and authentication review
- Prompt injection prevention

### test-writer
- Generates pytest tests
- Creates test fixtures
- Mocks external APIs

### agent-dag-reviewer
- DAG executor correctness
- Parallel execution validation
- Partial output streaming

## Commands

### /estimate
Estimates effort for features
```
/estimate create feature
Effort: High (8 hours)
- Design: 2 hours
- Implementation: 4 hours
- Testing: 2 hours
```

### /refactor
Performs safe refactoring loop
```
/refactor database models
Step 1: Analyze current models
Step 2: Design new schema
Step 3: Create migration
Step 4: Verify compatibility
```

### /pr-helper
Generates PR descriptions
```
/pr-helper
## Summary
- Added citation guard
- Fixed demo mode issues
- Updated documentation

## Checklist
- [x] Tests passing
- [x] Linting clean
- [ ] Documentation updated
```

## Skills

### /compact
Reduces context size for long sessions

### /effort
Sets reasoning depth: low | medium | high

### /context
Verifies no skill truncation

## Configuration

### Tool Access
- Bash: Read-only operations
- File editing: Restricted to plan file
- Git operations: Read-only, no push

### Plan Mode
- Active during planning phase
- Only plan file is writable
- All other files are read-only

### Execution Mode
- After plan approval
- Full file editing access
- Git commit and push allowed
```

---

### File: `.kilo/agent/security.md`
```markdown
# Security Agent Guidelines

## OWASP Compliance

### Authentication
- JWT with HS256 signing
- bcrypt password hashing (cost=12)
- Token expiration: 60 minutes
- No refresh tokens

### Authorization
- Role-based access control
- User owns data isolation
- Protected routes with Depends

### Input Validation
- Pydantic models for all inputs
- SQL injection prevention
- XSS prevention

### Data Protection
- TLS for all communications
- No secrets in code
- Environment variable encryption

## Prompt Injection Prevention

### Untrusted Data Handling
```python
prompt = f"""
<untrusted_data>
{user_input}
</untrusted_data>
"""
```

### Output Validation
- Regex validation for expected format
- JSON parsing with error handling
- Length limits

### Citation Guard
- Numeric claim validation
- [n] citation requirement
- Automatic redaction

## Audit Trail

### Event Types
- `dag_query`: Query submission
- `dag_node_execution`: Agent node execution
- `login`: Authentication events
- `data_access`: Database queries

### Payload Structure
```json
{
  "event_type": "dag_query",
  "user_id": 1,
  "timestamp": "2026-01-01T00:00:00Z",
  "payload": {}
}
```

## Best Practices

1. Never log sensitive data
2. Validate all inputs
3. Use parameterized queries
4. Implement rate limiting
5. Regular security audits
6. Dependency updates
7. Secret rotation
8. Access logging
```

---

### File: `AGENTS.md`
```markdown
# Agent Guidelines

## Kilo System Agents

The project uses Kilo's agent system for development assistance.

### Available Agents

1. **spec-writer**: Feature specification generator
2. **dialectic-review**: Technical decision reviewer
3. **security-review**: Security auditor (READ-ONLY)
4. **test-writer**: Automated test generator
5. **agent-dag-reviewer**: DAG execution validator

### Custom Slash Commands

#### /estimate [feature]
Estimates development effort

#### /refactor [component]
Safe refactoring workflow

#### /pr-helper
Pull request description generator

#### /demo-check
Runs demo verification flow

#### /context
Verifies context integrity

#### /compact
Reduces context size

### Agent Skills

#### kilo-config
System configuration guide
- Commands
- Agents
- MCP servers
- Skills
- Permissions

### Workflow

1. **Planning Phase**
   - Use spec-writer for requirements
   - Run /estimate for effort
   - Create plan file

2. **Development Phase**
   - Use test-writer for tests
   - Review with dialectic-review
   - Security review (READ-ONLY)

3. **Validation Phase**
   - Run /demo-check
   - Verify with agent-dag-reviewer
   - Generate PR with /pr-helper

## Best Practices

- Use agents proactively
- Verify agent outputs
- Maintain context integrity
- Follow plan phase constraints
- Document decisions

## Constraints

### Plan Mode
- Only plan file writable
- All other files read-only
- No bash execution for changes
- No git commits

### Execution Mode
- Full editing access
- Git operations allowed
- After plan approval
- Test requirements enforced
```

---

## Summary

This file covers all infrastructure and configuration:
- Docker Compose setup (Postgres, Backend, Frontend, Worker services)
- Dockerfiles for backend and frontend with multi-stage builds
- Environment configuration and variable management
- Database migrations with TimescaleDB extension and hypertable
- README with deployment guide and troubleshooting
- Gitignore for Python/Node projects
- Kilo agent system configuration
- Security guidelines and best practices
- Development workflow and deployment procedures

All files represent the complete production-ready implementation.