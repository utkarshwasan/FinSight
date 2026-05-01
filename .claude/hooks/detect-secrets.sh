#!/bin/bash  
# PreToolUse hook: detect hardcoded secrets before they're written to a file.  
set -euo pipefail  
INPUT=$(cat)  
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null || echo "")  
if [ -z "$CONTENT" ]; then exit 0; fi  
PATTERNS=(  
  'password\s*[:=]\s*"[^"]{6,}"'  
  'JWT_SECRET\s*=\s*"[^"$]{8,}"'  
  'GEMINI_API_KEY\s*=\s*"AIza[A-Za-z0-9_-]{35}"'  
  'FINNHUB_API_KEY\s*=\s*"[a-z0-9]{40,}"'  
  'GOOGLE_OAUTH_CLIENT_SECRET\s*=\s*"GOCSPX-[A-Za-z0-9_-]{28}"'  
  'sk_live_[A-Za-z0-9]{24,}'  
  'ghp_[a-zA-Z0-9]{36}'  
  'ghs_[a-zA-Z0-9]{36}'  
  'AKIA[0-9A-Z]{16}'  
  'DefaultEndpointsProtocol=.*AccountKey='  
)  
for pat in "${PATTERNS[@]}"; do  
  if echo "$CONTENT" | grep -iqE "$pat"; then  
    echo "BLOCKED: possible secret detected (pattern: ${pat:0:40}...)." >&2  
    echo "Use environment variables (.env, read via os.getenv) or a secret manager." >&2  
    exit 2  
  fi  
done  
exit 0