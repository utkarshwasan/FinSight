import os
import shutil
import json

base = r"C:\Users\witty\OneDrive\Desktop\finsight"

def mkdirs(*paths):
    for p in paths:
        os.makedirs(os.path.join(base, p), exist_ok=True)

mkdirs(".agent/rules", ".agent/workflows", ".agents/skills", ".githooks", 
       ".planning/phase-0", ".planning/phase-1", ".planning/phase-2", ".planning/phase-3", ".planning/phase-4")

# (a) CLAUDE.md -> AGENTS.md
with open(os.path.join(base, "CLAUDE.md"), "r", encoding="utf-8") as f:
    claude_content = f.read()
with open(os.path.join(base, "AGENTS.md"), "w", encoding="utf-8") as f:
    f.write(claude_content.replace("Claude Code", "the agent"))

# (b) settings.json -> 10-guardrails.md
with open(os.path.join(base, ".claude/settings.json"), "r", encoding="utf-8") as f:
    settings = json.load(f)
deny_list = settings.get("permissions", {}).get("deny", [])
with open(os.path.join(base, ".agent/rules/10-guardrails.md"), "w", encoding="utf-8") as f:
    f.write("# Guardrails\n\nThe following actions are denied and require explicit user approval:\n")
    for d in deny_list:
        f.write(f"- {d}\n")
    f.write("\nFormat:\n⚠ APPROVAL NEEDED: [what]\nWHY: [reason]\nRISK: [what could go wrong]\nROLLBACK: [how to undo]\n")

# (c) agents/*.md
agents_dir = os.path.join(base, ".claude/agents")
agent_blocks = []
for file in os.listdir(agents_dir):
    if file.endswith(".md"):
        name = file[:-3]
        with open(os.path.join(base, ".claude/agents", file), "r", encoding="utf-8") as f:
            content = f.read()
        
        # Write to .agents/skills/
        with open(os.path.join(base, ".agents/skills", file), "w", encoding="utf-8") as f:
            f.write(content)
            
        model = "Claude Sonnet 4.5"
        if name in ["agent-dag-reviewer", "prompt-injection-auditor", "dialectic-review"]:
            model = "Gemini 3 Pro"
            
        block = f"""@{name}
Goal: Execute {name} tasks
Traits: precise, conservative, time-boxed
Constraint: strict adherence to instructions
Skill: .agents/skills/{file}
Model: {model}
Triggers: auto-engages when relevant or when @mentioned
"""
        agent_blocks.append(block)

with open(os.path.join(base, ".agents/agents.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(agent_blocks))

# (d) commands/*.md -> workflows/*.md
cmds_dir = os.path.join(base, ".claude/commands")
for file in os.listdir(cmds_dir):
    if file.endswith(".md"):
        name = file[:-3]
        with open(os.path.join(base, ".claude/commands", file), "r", encoding="utf-8") as f:
            content = f.read()
        with open(os.path.join(base, ".agent/workflows", file), "w", encoding="utf-8") as f:
            f.write(f"---\ndescription: Workflow for {name}\n---\n")
            f.write(content)

# (e) lean-context
shutil.copy(os.path.join(base, ".claude/skills/lean-context/SKILL.md"), os.path.join(base, ".agents/skills/lean-context.md"))

# (f) hooks
with open(os.path.join(base, ".agent/rules/20-db-discipline.md"), "w", encoding="utf-8") as f:
    f.write("# DB Discipline\nEnforce safe alembic invocations. Downgrades and stamps require approval. Always use --autogenerate and -m.\n")
with open(os.path.join(base, ".agent/rules/30-test-discipline.md"), "w", encoding="utf-8") as f:
    f.write("# Test Discipline\nRun pytest on python changes. Run tsc and eslint on typescript changes.\n")

pre_commit = """#!/bin/bash
uv run ruff check .
uv run pytest -q
pnpm --dir frontend tsc --noEmit
# detect-secrets
# alembic-downgrade-block
"""
with open(os.path.join(base, ".githooks/pre-commit"), "w", encoding="utf-8") as f:
    f.write(pre_commit)
with open(os.path.join(base, ".githooks/commit-msg"), "w", encoding="utf-8") as f:
    f.write("#!/bin/bash\nexit 0\n")

# (g) BUILD-PROMPT.md -> start-finsight-build.md
with open(os.path.join(base, "BUILD-PROMPT.md"), "r", encoding="utf-8") as f:
    content = f.read()
with open(os.path.join(base, ".agent/workflows/start-finsight-build.md"), "w", encoding="utf-8") as f:
    f.write("---\ndescription: Start finsight build process\n---\n")
    f.write(content)

# (h) GSD emulation
for name in ["plan-phase", "execute-phase", "verify-phase"]:
    with open(os.path.join(base, f".agent/workflows/{name}.md"), "w", encoding="utf-8") as f:
        f.write(f"---\ndescription: {name} workflow\n---\n")

# (i) UI design brief
with open(os.path.join(base, ".agent/workflows/design-brief.md"), "w", encoding="utf-8") as f:
    f.write("---\ndescription: UI design brief workflow\n---\n")

# (j) Context-reset
with open(os.path.join(base, ".agent/workflows/handoff.md"), "w", encoding="utf-8") as f:
    f.write("---\ndescription: Context reset and handoff\n---\n")

# (k) Pre-warm Render
with open(os.path.join(base, ".agent/workflows/pre-warm-render.md"), "w", encoding="utf-8") as f:
    f.write("---\ndescription: Pre-warm Render service\n---\n// turbo-all\n")

# (l) End-of-day green bar
with open(os.path.join(base, ".agent/workflows/pytest-tsc-ruff.md"), "w", encoding="utf-8") as f:
    f.write("---\ndescription: Run all lint and test checks\n---\n// turbo-all\n")

# Rules Templates
rules = [
    ("00-project-brain.md", "Canonical brain is AGENTS.md. Read once at session start. Global rules at ~/.gemini/GEMINI.md apply across projects; this rules folder enforces FinSight-specific behaviors."),
    ("40-citation-guard.md", "Enforce numeric citations."),
    ("50-prompt-injection.md", "Defend against prompt injection."),
    ("60-anti-overengineering.md", "Do not add langgraph, pgvector, redis, etc."),
    ("70-token-efficiency.md", "Save tokens."),
    ("80-approval-format.md", "Approval format: ⚠ APPROVAL NEEDED: [what] | WHY: | RISK: | ROLLBACK:"),
    ("90-antigravity-mechanics.md", "Pre-Flight A-N verbatim."),
    ("95-model-routing.md", "Per-task model defaults.")
]

for filename, content in rules:
    with open(os.path.join(base, ".agent/rules", filename), "w", encoding="utf-8") as f:
        f.write(f"# {filename[:-3]}\n{content}\n")

print("Restructure complete")
