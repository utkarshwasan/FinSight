# Setup on a new machine

## 1. System prerequisites

| Tool | Version | Verify |  
|---|---|---|  
| Python | 3.12+ | `python --version` |  
| Node.js | 22 LTS | `node --version` |  
| Docker Desktop | 4.x | `docker --version` |  
| Git | 2.x | `git --version` |  
| `uv` | latest | `pip install uv && uv --version` |  
| `pnpm` | 9.x | `npm i -g pnpm && pnpm --version` |  
| GitHub CLI | 2.x | `gh --version` |

**Windows extras:** Git for Windows ships Git Bash — required for our `.sh` hooks.

## 2. Install Claude Code

```bash  
npm install -g @anthropic-ai/claude-code  
claude --version    # expect 2.1.x or higher  
claude              # opens browser for SSO/login; run /exit when done  
```

## 3. Copy this bundle

**Option A (OneDrive sync):** Sign in to OneDrive on the new machine; the folder appears.

**Option B (git clone):**  
```bash  
gh repo clone <user>/finsight ~/finsight  
cd ~/finsight  
```

## 4. Set environment variables

```bash  
cp .env.example .env  
# Edit .env and fill:  
#   GEMINI_API_KEY      → https://aistudio.google.com/apikey   (free)  
#   FINNHUB_API_KEY     → https://finnhub.io/register          (free, 60 req/min)  
#   JWT_SECRET          → python -c "import secrets; print(secrets.token_hex(32))"  
#   GOOGLE_OAUTH_*      → optional; leave blank for Day 1-2; fill on Day 3  
```

Set Claude Code env vars:  
```bash  
# Windows PowerShell  
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_xxx", "User")  
# macOS/Linux  
echo 'export GITHUB_TOKEN=ghp_xxx' >> ~/.zshrc  
```

## 5. Wave-based plugin install

### Wave 1 — Day 1 essentials  
```bash  
cd ~/finsight  
claude  
/plugin marketplace add shinpr/claude-code-workflows  
/plugin install dev-workflows@claude-code-workflows  
/plugin install dev-workflows-frontend@claude-code-workflows  
/plugin install superpowers@claude-plugins-official  
/plugin install ralph-loop@claude-plugins-official  
/reload-plugins  
/context  
```

### Wave 1.5 — Install GSD  
```bash  
/exit  
npx get-shit-done-cc@latest  
# Runtime = Claude Code; Location = Local  
echo ".planning/" >> .gitignore  
echo ".claude/get-shit-done/" >> .gitignore  
claude  
/gsd:help  
```

### Wave 2 — Day 2 morning (UI polish)  
```bash  
/plugin install frontend-design@claude-plugins-official  
/plugin marketplace add Schoepplake/framer-motion-skill  
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill  
/plugin install ui-ux-pro-max@nextlevelbuilder-ui-ux-pro-max-skill  
/reload-plugins  
/context  
```

After install, run `ui-ux-pro-max` ONCE with the scoped prompt in `docs/UI-INSPIRATION.md §8`. Paste resulting tokens into `frontend/src/styles/tokens.ts` and commit. Never tweak again.

### Wave 3 — Day 1 MCP servers  
```bash  
claude mcp add github -- npx -y @modelcontextprotocol/server-github  
claude mcp add context7 -- npx -y @upstash/context7-mcp  
```

## 6. First run

```bash  
docker compose up  
docker compose exec backend uv run alembic upgrade head  
docker compose exec backend uv run python -m app.scripts.seed_demo  
```

Open:  
- Backend health: http://localhost:8000/healthz  
- API docs: http://localhost:8000/docs  
- Frontend: http://localhost:5173  
- Login: `demo@finsight.ai` / `demo123`

## 7. Daily workflow

```bash  
cd ~/finsight  
git pull origin main  
claude  
sync context  
/effort medium  
/color blue  
```

## 8. Troubleshooting

| Symptom | Fix |  
|---|---|  
| Plugin truncation | Token budget exceeded. `/plugin uninstall <name>` |  
| `docker compose up` line-ending error | `git config --global core.autocrlf input` |  
| TimescaleDB extension fails | Use `timescale/timescaledb:latest-pg16`, not `postgres:16` |  
| Prophet install fails | Use `prophet>=1.1.5` from PyPI, NOT `fbprophet` |  
| Render WS disconnects | Poll `/healthz` from FE or upgrade to Starter ($7) |  
| OAuth callback 400 | `GOOGLE_OAUTH_REDIRECT_URI` must match exactly |