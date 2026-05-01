---
description: Workflow for pr-helper
---
---  
description: Generate a PR description and 11-point self-review checklist for the current branch.  
---

Generate a PR description and run a self-review checklist for the changes between the current branch and `main`.

## Steps

1. Run `git log --oneline main..HEAD`  
2. Run `git diff main..HEAD --stat`  
3. Run `git diff main..HEAD` (or `head -300` if huge)  
4. Group commits by Conventional Commit type  
5. Generate PR description using template below  
6. Run 11-point self-review

## PR description template

```markdown  
## What  
One sentence — user-visible behavior.

## Why  
One sentence — PDF requirement, ADR, or feature ID.

## How  
3-5 bullets on implementation approach.

## Files changed (high-signal only)  
- `<path>` — <one-line purpose>

## Testing done  
- [ ] `pytest -q` — <X> passed, <Y> new tests added  
- [ ] `tsc --noEmit` — clean  
- [ ] `ruff check` — clean  
- [ ] Manual: <flow tested>

## Screenshots / GIFs  
## Known follow-ups  
```

## 11-point self-review checklist

1. **Build clean** — pytest, tsc, ruff all green  
2. **DI not bypassed** — no `Session()` or `engine` in routes; `Depends(get_db)` used  
3. **Async with timeouts** — every httpx client has `timeout=`; external calls have retry+backoff  
4. **DTOs only** — no ORM model returned; no password hash in any response  
5. **Auth correct** — every protected route has `Depends(get_current_user)`; ownership verified  
6. **Untrusted-data tagged** — every external string to LLM wrapped in `<untrusted_data>` tags  
7. **Citations enforced** — any new numeric output path passes through CitationGuard  
8. **Audit log writes** — every new AI call writes to `audit_events`  
9. **No secrets committed** — `git diff` contains no `.env`, API keys, or tokens  
10. **Conventional Commits** — every commit starts with `feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`  
11. **Migrations included** — if new entity or column added, Alembic migration is in this PR