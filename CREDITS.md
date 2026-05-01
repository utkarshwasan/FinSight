# Credits & Borrowed Patterns

Anti-plagiarism shield: every snippet > 10 LOC borrowed from an external source is cited here.

## Patterns referenced (concept-level, no code copied)

| Pattern | Source | Where used |  
|---|---|---|  
| React Flow node-state DAG visualization | virattt/ai-hedge-fund | frontend/src/components/DAGVisualizer.tsx |  
| Inline citation chip + hover-card pattern | JonniTech/Perplexity-Clone | frontend/src/components/CitationChip.tsx |  
| Prophet `forecast(df) -> DataFrame` minimal wiring | BhakeSart/Stock-Market-Predictor-using-Prophet | backend/app/services/prophet_service.py |  
| Layered architecture diagram convention | AI4Finance-Foundation/FinRobot | README.md, docs/DESIGN.md |  
| One-line value-prop README header | OpenBB-finance/OpenBB | README.md |  
| Demo-mode fixture record/replay concept | CopilotKit/llmock | backend/app/services/demo_fixtures.py |  
| RFC 7807 problem+json error envelope | RFC 7807 | backend/app/middleware/error.py |

## Code snippets > 10 LOC borrowed verbatim

(none yet — fill in during build)

Format:  
```  
### <component name>  
**Source:** <URL with permalink>  
**License:** <license type>  
**File:** <our file path>:<line range>  
**Why borrowed:** <reason>  
**Modifications:** <what we changed>  
```

## Internal carry-overs (from candidate's prior work)

| Pattern | Source project | Where used |  
|---|---|---|  
| Append-only audit log + middleware capture | EduLearn (private) | backend/app/middleware/audit.py |  
| JWT 60-min, no refresh token issuance | EduLearn (private) | backend/app/auth/jwt.py |  
| Hand-rolled DAG executor with topological sort | Visual Workflow Orchestrator (private) | backend/app/agents/executor.py |  
| WebSocket fan-out via in-process pubsub | Nexus.ai (private) | backend/app/routes/ws.py |  
| Gemini 2.0 Flash + structured-output integration | VoxRay AI (private) | backend/app/services/gemini_client.py |

## AI assistance disclosure

Code in this repository was produced with the assistance of Claude Code (Anthropic) by the author. All architectural decisions, ADR rationale, prompts, agent contracts, and integration design were authored by Utkarsh Wasan; AI assisted in scaffolding boilerplate under direct review. No code was copy-pasted from blog posts, tutorials, or other repositories without citation in the table above.