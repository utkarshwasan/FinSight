#!/bin/bash  
# PreToolUse hook: enforce safe alembic invocations.  
set -euo pipefail  
INPUT=$(cat)  
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")  
if [[ "$COMMAND" != *alembic* ]]; then exit 0; fi  
if [[ "$COMMAND" == *"alembic downgrade"* ]]; then  
  echo "BLOCKED: alembic downgrade is denied. If you need to revert a migration, do it manually after explicit user approval." >&2  
  exit 2  
fi  
if [[ "$COMMAND" == *"alembic stamp"* ]]; then  
  echo "BLOCKED: alembic stamp rewrites the version pointer. Ask user approval and document in an ADR before using." >&2  
  exit 2  
fi  
if [[ "$COMMAND" == *"alembic revision"* ]] && [[ "$COMMAND" != *"--autogenerate"* ]]; then  
  echo "WARNING: 'alembic revision' without --autogenerate creates an empty migration." >&2  
fi  
if [[ "$COMMAND" == *"alembic revision"* ]] && [[ "$COMMAND" != *"-m "* ]]; then  
  echo "WARNING: 'alembic revision' without -m produces a hash-only filename." >&2  
fi  
exit 0