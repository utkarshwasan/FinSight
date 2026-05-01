#!/bin/bash  
# PostToolUse hook: when Claude edits a .ts/.tsx file, remind to type-check.  
set -euo pipefail  
INPUT=$(cat)  
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")  
if [ -z "$FILE_PATH" ]; then exit 0; fi  
case "$FILE_PATH" in  
  *.ts|*.tsx)  
    echo ""  
    echo "⚛  TypeScript file modified: $FILE_PATH"  
    echo "   Type-check:  pnpm --dir frontend tsc --noEmit"  
    echo "   Lint:        pnpm --dir frontend eslint $FILE_PATH"  
    ;;  
esac  
exit 0