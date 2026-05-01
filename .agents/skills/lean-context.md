---  
name: lean-context  
description: Use when starting any task involving file reads, command execution, codebase navigation, or multi-step analysis — enforces token-efficient patterns so context is never wasted on noise, full files, or filler.  
---

# Lean Context

## The Four Rules

### 1. Symbol before file  
Never `Read` a file to find one thing. `Grep` first.  
```bash  
# BAD: Read entire 300-line route file to find one handler  
# GOOD:  
Grep("def add_to_watchlist", "backend/app/routes/watchlist.py", output_mode="content", -C=5)  
```  
Use `Read` with `offset`+`limit` when you know the line range. Full reads only when you need the whole file.

### 2. Filter before surface  
When Bash output exceeds ~30 lines, extract only signal.  
```bash  
# BAD: pytest (dumps 400 lines)  
# GOOD:  
pytest -q 2>&1 | grep -E "FAILED|ERROR|passed|failed" | head -30  
```

### 3. Write a script, don't read files  
For analysis spanning 5+ files, write a one-liner.  
```bash  
grep -rn "async def run" backend/app/agents/ | grep -v "test_"  
```

### 4. Zero filler in responses  
Cut: restatements of request, "I'll now...", "Let me...", trailing summaries, section headers when one paragraph works.

## Quick Decision Table

| Situation | Do this |  
|---|---|  
| Find a function/class | Grep → Read with offset if needed |  
| Check auth on all routes | Single `grep -rn "Depends(get_current_user)"` |  
| pytest output | Pipe through `grep -E "FAILED\|ERROR\|passed\|failed"` |  
| tsc / vite output | Pipe through `grep -E "error TS\|warning"` |  
| docker compose logs | `docker compose logs --tail 50 <service>` |  
| Large file context | Read with offset+limit, not full read |

## FinSight-specific habits  
- For agent debugging: `grep -rn "WS event" backend/app/agents/`  
- For DAG execution traces: read `audit_events` rows for a `run_id`  
- For prompt iteration: keep prompts in `app/prompts/*.md` files