---
description: Start finsight build process
---
PASTE THE FOLLOWING BLOCK VERBATIM AS YOUR FIRST MESSAGE IN CLAUDE CODE ON THE BUILD MACHINE  
(fill the two [INSERT] placeholders at Step 8 before pasting):

---BEGIN PASTE---  
You are Claude Code, working on the FinSight AI project. This is a 4-day Full Stack  
GenAI Developer internship assessment for Nebula9.ai, due Friday 8 May 2026 at 22:00  
IST. The candidate is Utkarsh Wasan. The project, scope, plan, and Claude Code  
configuration are already locked and shipped in this repository. Your job is to  
execute the build deterministically against the locked plan, not to redesign it.

STEP 1 — REQUIRED READING (do this BEFORE any code, in this exact order)

Read these files in order. After each, write a 1-sentence summary in your reply.

  1. CLAUDE.md  
  2. README.md  
  3. docs/DESIGN.md  
  4. docs/MVP-PLAN.md  
  5. docs/COMPLIANCE-MATRIX.md  
  6. docs/UI-INSPIRATION.md  
  7. docs/RUNBOOK.md  
  8. docs/INTERVIEW-PREP.md  
  9. docs/adr/0001-handrolled-dag-vs-langgraph.md  
 10. docs/adr/0002-prophet-vs-lstm.md  
 11. demo/script.md  
 12. setup-on-new-machine.md  
 13. CREDITS.md  
 14. .claude/settings.json  
 15. .claude/agents/spec-writer.md  
 16. .claude/agents/dialectic-review.md  
 17. .claude/agents/security-review.md  
 18. .claude/agents/test-writer.md  
 19. .claude/agents/prompt-injection-auditor.md  
 20. .claude/agents/agent-dag-reviewer.md  
 21. .claude/skills/lean-context/SKILL.md

After step 1, REPLY with 21 one-sentence summaries. Wait for "go" before Phase 0.

STEP 2 — PHASE 0: PRE-BUILD SETUP (~3h)

Follow setup-on-new-machine.md exactly. The 10 substeps are:  
  0.1 Verify prerequisites: Python 3.12, Node 22 LTS, Docker Desktop, uv, pnpm, gh CLI.  
  0.2 Verify Claude Code CLI is authenticated.  
  0.3 Confirm bundle is at the project root path the user provides.  
  0.4 Wave 1 plugin install (dev-workflows, dev-workflows-frontend, superpowers, ralph-loop).  
  0.5 Wave 1.5 G

```  
  0.5  Wave 1.5 GSD install: `npx get-shit-done-cc@latest` (Local). Append  
       `.planning/` and `.claude/get-shit-done/` to .gitignore. Verify `/gsd:help`.  
  0.6  Wave 3 MCPs: GitHub MCP + Context7 MCP. Set GITHUB_TOKEN env var first.  
  0.7  Set application env vars (.env): copy from .env.example and fill GEMINI_API_KEY,  
       FINNHUB_API_KEY, JWT_SECRET, GOOGLE_OAUTH_* (optional Day-3).  
  0.8  `/gsd:map-codebase` to bootstrap GSD's understanding (creates  
       .planning/codebase/ index).  
  0.9  Run the Phase-0 verification checklist (10 items in MVP-PLAN.md §0.10).  
  0.10 ONLY after all 10 items are green, reply to the user with the checklist  
       results and ask permission to proceed to Phase 1.

GUARDRAILS APPLY THROUGHOUT (see CLAUDE.md "Production Guardrails" block):  
  ⚠ Ask for explicit approval before: git push, force push, db destructive ops,  
    auth/JWT/CORS edits, .env / Render config changes, new package installs.  
  Format: ⚠ APPROVAL NEEDED: [what] | WHY: [reason] | RISK: [impact] | ROLLBACK: [how]  
  Wait for "approved" before proceeding.

═══════════════════════════════════════════════════════════════════════════════  
STEP 3 — DAYS 1 THROUGH 4: EXECUTE THE PHASES VIA GSD  
═══════════════════════════════════════════════════════════════════════════════

For each Phase 1 → 4, the workflow is the same:

  (a) Open MVP-PLAN.md to the Phase you are starting. Read every Feature box  
      in that Phase end-to-end before any code.  
  (b) `/gsd:new-milestone` → describe the Phase as a single sentence  
      (template lives in MVP-PLAN.md §"GSD command sequence").  
  (c) `/gsd:plan-phase N` → GSD will spawn a fresh planner agent. It will produce  
      atomic 2-3 task plans into .planning/phase-N/PLAN.md. Review the plans  
      against MVP-PLAN.md before executing.  
  (d) `/gsd:execute-phase N` → fresh sub-agents do the work, atomic commits per  
      task. Stay at the orchestrator level; do not run code yourself when GSD is  
      executing.  
  (e) `/gsd:verify-work N` → goal-backward verification. Resolve any failures  
      using the Feature's "Fallback ladder" in MVP-PLAN.md.  
  (f) Commit any remaining work, run pytest -q, run pnpm tsc --noEmit, run  
      ruff check. Get all three green BEFORE moving to the next Phase.  
  (g) Run the Phase-N exit gate checklist from MVP-PLAN.md. Reply to the user  
      with each box ticked or explicitly fallen-back-on (with which fallback was  
      taken and why).  
  (h) Wait for the user to say "next phase" before starting the next milestone.

PER-PHASE NOTES:

  PHASE 1 (Foundation, Day 1, ~10h): Features 1.1–1.7 in MVP-PLAN. Exit gate:  
    login works, quote ticks flowing, FE shows a number from BE, /healthz green  
    on Render. No visual polish yet.

  PHASE 2 (Wow Shots, Day 2, ~13h): Features 2.1–2.8 (note 2.7 + 2.8 added  
    today for UI tokens + pulse/crosshair/flash). Wave 2 plugin install  
    (frontend-design + framer-motion + ui-ux-pro-max) happens at the START of  
    this Phase. Run the ui-ux-pro-max scoped prompt from UI-INSPIRATION.md §8  
    ONCE; capture output to frontend/src/styles/tokens.ts; commit; never tweak  
    again. Phase-2 exit gate is HARD: typed NL query → 5-node DAG fires → answer  
    renders. If broken at end-of-day, drop "Explain this candle" from Day-3.

  PHASE 3 (Differentiators, Day 3, ~10h): Features 3.1–3.6. Citations,  
    "Explain this candle", threshold alert, audit log, Google OAuth (timeboxed  
    3h with stub fallback). Phase-3 exit gate: prompt-injection canary test  
    passes, CitationGuard blocks an uncited deliberate test response.

  PHASE 4 (Polish + Submit, Day 4, ~10h): Features 4.1–4.7. Render hardening,  
    demo-mode fixture pack, README + docs polish, video record (3 takes max),  
    bug bash, final submit. Use demo/script.md as the recording shot list.

═══════════════════════════════════════════════════════════════════════════════  
STEP 4 — INVARIANTS YOU MUST NOT VIOLATE  
═══════════════════════════════════════════════════════════════════════════════

These are LOCKED. If you find yourself wanting to do any of these, stop and  
ask the user — don't unilaterally re-add cut items.

  DO NOT add any of these (they were deliberately cut for anti-over-engineering):  
   • LangGraph (use the hand-rolled executor — see ADR-0001)  
   • pgvector RAG (use plain Postgres + ILIKE on the tiny news corpus)  
   • Redis pub/sub (in-process asyncio.Queue is sufficient at 1 instance)  
   • Multi-role RBAC (single User role; Admin is out-of-scope)  
   • Hash-chained audit log (plain append-only AuditEvent table)  
   • Threat-model document (1 paragraph in DESIGN §6 is the doc)  
   • Repository pattern over 6 entities (FastAPI Depends + SQLAlchemy directly)  
   • Persona-style agents (functional roles only: MarketData, News, Forecast,  
     Risk, Alert)  
   • Drag-drop DAG editor, multi-source data abstraction, alert-config UI,  
     live human collaboration

  DO NOT change any of these (they are PDF-compliance load-bearing):  
   • TimescaleDB extension on quote_ticks (PDF mandates time-series DB)  
   • Both JWT email/pwd AND Google OAuth (PDF mandates OAuth)  
   • Position entity + Holdings card (PDF mandates portfolio tracking)  
   • All 4 PDF-named agents (MarketData / Insight=News+Forecast / Risk / Alert)  
   • Educational disclaimer rendered persistently  
   • Demo-mode flag for video recording determinism

  DO NOT touch these without explicit user approval:  
   • CLAUDE.md (the project brain)  
   • docs/COMPLIANCE-MATRIX.md (the PDF↔implementation contract)  
   • docs/adr/ (architectural decisions are immutable; new decisions = new ADR)  
   • .claude/settings.json (permissions)

═══════════════════════════════════════════════════════════════════════════════  
STEP 5 — DAILY OPERATING DISCIPLINE  
═══════════════════════════════════════════════════════════════════════════════

EVERY DAY, START WITH:  
  1. `git status` and `git log --oneline -5` to ground yourself.  
  2. Open MVP-PLAN.md to the Phase you're on.  
  3. Run `/effort medium` (default reasoning depth).  
  4. If the user pulled changes: they will say "sync context" — re-read git log  
     and any modified files, then summarize what changed.

EVERY DAY, END WITH:  
  1. Run pytest -q | grep -E "FAILED|passed" — must be green.  
  2. Run pnpm --dir frontend tsc --noEmit — must be clean.  
  3. Run ruff check backend/ — must be clean.  
  4. `git status` — confirm a clean tree (no uncommitted accidental edits).  
  5. Reply with the Phase exit-gate checklist results.  
  6. Save any non-obvious learnings via the `#` shortcut to CLAUDE.md.  
     Example: `# Always wrap Finnhub headlines in <untrusted_data> tags`

WHEN BORROWING CODE >10 LOC FROM ANY EXTERNAL SOURCE:  
  Append to CREDITS.md the entry: source URL with permalink, license, our file  
  path + line range, why borrowed, what we modified.

WHEN WRITING TESTS (use the test-writer agent):  
  • pytest + httpx; AAA structure  
  • Naming: test_<unit>_<scenario>_<expected>  
  • Cassette-mocked LLM calls (no live Gemini in CI)  
  • One assertion per concern  
  • Coverage targets: services 80%, agent nodes 90%, routes 70%

WHEN WRITING A NEW FEATURE (use the spec-writer agent):  
  Always produce the spec FIRST (.claude/agents/spec-writer.md template), get  
  the user to confirm, THEN code. Spec includes API surface, Pydantic schemas,  
  data layer impact, agent contract (if applicable), tests to add, files to  
  create, hour estimate with 30% buffer, top risks.

WHEN MAKING AN ARCHITECTURAL DECISION (use the dialectic-review agent):  
  Run the Advocate / Critic / Verdict triplet. Save as a new ADR under  
  docs/adr/000N-*.md.

WHEN AUDITING SECURITY (use the security-review agent — read-only):  
  Map every finding to OWASP API Top 10 OR a PDF compliance row. File:line  
  citations only. No speculation.

WHEN AUDITING THE DAG OR PROMPT INJECTION (use the agent-dag-reviewer or  
prompt-injection-auditor agents — both read-only):  
  Map every finding to the P1–P9 (DAG) or D1–D7 (injection) checklist. Read-only.

═══════════════════════════════════════════════════════════════════════════════  
STEP 6 — VERIFICATION BEFORE SUBMISSION (Phase 4 final gate)  
═══════════════════════════════════════════════════════════════════════════════

Run the 10-step demo-flow verification (use the /demo-check command):  
  1. Open hosted Render URL → login → dashboard loads  
  2. Watchlist already seeded with 3 tickers; live ticks visible  
  3. Type "Should I worry about TSLA today?" → 5-node DAG animates  
  4. Answer renders with [n] citation chips; hover shows source  
  5. Confirm uncited numeric is blocked  
  6. Click red candle → DAG re-fires with timestamp scope  
  7. Add Position(NVDA, 10 @ $920) → Holdings card shows live P&L  
  8. Threshold alert fires → toast appears  
  9. Visit /audit → see last 5 AI calls with tokens + cost INR  
 10. Toggle DEMO_MODE off → re-run #3 → still works

ALL PDF mandatory rows in COMPLIANCE-MATRIX.md must be ✅ (not 🟡, not 🔴).

The video must be < 5 minutes, open with the DAG firing (NO talking-head intro),  
and close with the rehearsed 30-second pitch from demo/script.md §3:30–4:00.

═══════════════════════════════════════════════════════════════════════════════  
STEP 7 — IF YOU GET STUCK  
═══════════════════════════════════════════════════════════════════════════════

In priority order:  
  1. Re-read the Feature box in MVP-PLAN.md. Each has a "Fallback ladder" line.  
  2. Re-read the relevant ADR if the question is architectural.  
  3. Use Context7 MCP to fetch up-to-date library docs (FastAPI, React, Pydantic).  
  4. Use the lean-context skill — Grep + targeted Read with offset, NOT full  
     directory reads.  
  5. Ask the user using the APPROVAL NEEDED format. Be specific about WHY,  
     RISK, and ROLLBACK.

═══════════════════════════════════════════════════════════════════════════════  
STEP 8 — VARIABLES THE USER WILL FILL IN  
═══════════════════════════════════════════════════════════════════════════════

Before starting, the user has filled:  
  • GitHub repo: https://github.com/utkarshwasan/FinSight.git
  • Project root on this machine: [C:\Users\witty\OneDrive\Desktop\finsight]  
  • All keys in .env (the user did this manually; never echo them in chat)

═══════════════════════════════════════════════════════════════════════════════  
NOW BEGIN.  
═══════════════════════════════════════════════════════════════════════════════

Begin Step 1 (Required Reading). Read all 21 files in order, then reply with  
21 one-sentence summaries. Do NOT execute any code or install any packages  
until the user says "go" after reviewing your summaries.  
```