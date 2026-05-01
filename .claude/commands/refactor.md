---  
description: Safely refactor code while preserving behavior, using a tight build-test loop.  
---

Refactor the code described in: $ARGUMENTS

## The loop (do not skip steps)

1. **Capture baseline.** Run `pytest -q 2>&1 | grep -E "passed|failed|error"` and `tsc --noEmit`. Note pass count.  
2. **Identify ONE smell.** Name it precisely.  
3. **Apply ONE small change.**  
4. **Re-run baseline.** Pass count must equal or exceed step 1.  
5. **If green:** commit with `refactor: <smell> in <file>`. Loop back.  
6. **If red:** `git diff` the change, revert if can't fix in 5 minutes.

## What NOT to refactor (deliberate decisions, require ADR to change)  
- Hand-rolled DAG executor — do not replace with LangGraph  
- Single-role auth — do not introduce multi-role RBAC  
- Plain audit log — do not hash-chain entries  
- In-process WS pubsub — do not introduce Redis pub/sub  
- Vanilla Postgres + TimescaleDB hypertable — do not introduce pgvector or InfluxDB  
- Keyword retrieval — do not introduce embedding RAG  
- Repository pattern — do not introduce; FastAPI Depends + SQLAlchemy directly is the chosen pattern

## What IS in scope  
- Code clarity (naming, function size, parameter count)  
- Removing duplication (rule of three)  
- Extracting Pydantic models for repeated dict shapes  
- Adding type hints to untyped functions  
- Replacing inline numeric literals with named constants  
- Splitting files that exceed ~400 LOC

## Rules  
1. One refactor per commit.  
2. Tests must pass between every commit.  
3. No behavior change.  
4. No mass formatting (run as separate chore: commits).  
5. Stop after 3 loops per session.