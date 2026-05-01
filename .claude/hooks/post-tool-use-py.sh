#!/bin/bash  
# PostToolUse hook: when Claude edits a .py file, remind to run pytest.  
set -euo pipefail  
INPUT=$(cat)  
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")  
if [ -z "$FILE_PATH" ]; then exit 0; fi  
case "$FILE_PATH" in  
  *backend/*.py|*backend/**/*.py|*.py)  
    if [[ "$FILE_PATH" == *.py ]]; then  
      echo ""  
      echo "🐍 Python file modified: $FILE_PATH"  
      echo "   Run:  uv run pytest -q 2>&1 | grep -E 'FAILED|ERROR|passed|failed'"  
      echo "   Lint: uv run ruff check $FILE_PATH"  
    fi  
    ;;  
esac  
exit 0