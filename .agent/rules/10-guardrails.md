# Guardrails

The following actions are denied and require explicit user approval:
- Read(.env)
- Read(.env.*)
- Edit(.env)
- Edit(.env.*)
- Read(**/*.pem)
- Read(**/*.key)
- Read(**/*.pfx)
- Bash(curl http://169.254.169.254/*)
- Bash(sudo *)
- Bash(rm -rf *)
- Bash(rm -rf /*)
- Bash(git push --force *)
- Bash(git push -f *)
- Bash(git reset --hard origin/*)
- Bash(docker volume rm *)
- Bash(docker compose down -v)
- Bash(alembic downgrade *)
- Bash(psql -c *DROP DATABASE*)
- Bash(psql -c *TRUNCATE*)

Format:
⚠ APPROVAL NEEDED: [what]
WHY: [reason]
RISK: [what could go wrong]
ROLLBACK: [how to undo]
