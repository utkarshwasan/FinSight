---  
description: Estimate effort in hours for a FinSight feature, broken down by layer with a 30% buffer.  
---

Estimate the effort for the feature described in: $ARGUMENTS

Use the FinSight stack and the locked architecture (5-node DAG, 6 entities, no LangGraph, no pgvector, no Redis, single role). Break the estimate into layers below. Apply a **30% buffer**. Round to the nearest 0.5h.

## Output format

```markdown  
# Estimate: <feature name>

## Layers  
| Layer | Sub-task | Hours |  
|---|---|---|  
| Database | migration + entity | 0.5 |  
| Backend service | <function names> | 1.0 |  
| Backend route | <method + path> | 1.0 |  
| Agent node (if applicable) | prompt + post-process | 1.5 |  
| WebSocket events | new event types | 0.5 |  
| Frontend component | <component name> | 2.0 |  
| Frontend wiring | TanStack Query + state | 1.0 |  
| Tests | pytest + cassette + happy path + 2 edges | 1.5 |  
| Docs / ADR (if architectural) | 1 page | 0.5 |  
| **Subtotal** | | <X> |  
| **Buffer (30%)** | | <X * 0.3> |  
| **Total** | | **<X * 1.3>** |

## Risks (with hours added if risk lands)  
## Fallback if over-budget  
## Phase fit  
## Reuse opportunities  
```

## Reference effort ranges  
| Task type | Range |  
|---|---|  
| New SQLAlchemy entity + Alembic migration | 0.5–1h |  
| New Pydantic DTO pair | 0.25–0.5h |  
| New FastAPI route (CRUD) | 0.5–1.5h |  
| New agent node | 1.5–3h |  
| New shadcn React component | 1.5–3h |  
| New TanStack Query hook | 0.5–1h |  
| pytest test (3 scenarios) | 0.5–1h |  
| LLM cassette | 0.25h |  
| ADR | 0.5h |

## Rules  
1. No estimate < 0.5h.  
2. Always include tests in the estimate.  
3. Compare against day's remaining budget. Day 1=10h, Day 2=11h, Day 3=10h, Day 4=10h.  
4. Flag overflow.  
5. State the fallback ladder.