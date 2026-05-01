# ADR-0001 — Hand-rolled DAG executor over LangGraph

**Status:** Accepted | **Date:** 2026-04-29 | **Decider:** Utkarsh Wasan

## Context  
The brief asks for a multi-agent pipeline. Standard choice is LangGraph. Alternative: ~80 lines of asyncio + topological sort. I have prior experience implementing this pattern (Visual Workflow Orchestrator — Kahn's algorithm, cycle detection, DAG-based ETL). I have **no** production LangGraph experience.

## Decision  
**Hand-roll the DAG executor.**

```python  
# Pseudocode — 80 LOC total  
async def run_dag(nodes, state, on_event):  
    deps = {n.name: set(n.depends_on) for n in nodes}  
    by_name = {n.name: n for n in nodes}  
    completed = set()  
    pending = [n.name for n in nodes if not deps[n.name]]  
    while pending:  
        ready = [n for n in pending if deps[by_name[n].name] <= completed]  
        results = await asyncio.gather(*[run_node(by_name[n], state, on_event) for n in ready])  
        completed.update(ready)  
        pending = [n for n in pending if n not in ready] + [  
            n.name for n in nodes  
            if n.name not in completed and n.name not in pending and deps[n.name] <= completed  
        ]  
```

## Consequences

**Positive:**  
- Full instrumentation — each node emits WS partial-output events directly  
- No dependency on LangChain version churn (4 breaking API changes in 2025)  
- Demo callback to prior project (strong interview moment)  
- Tighter token budget — no tool-call indirection  
- Easier to test — each node is `async def run(state) -> state`

**Negative:**  
- Reinventing the wheel for >10 nodes with conditional edges  
- No free LangSmith tracing  
- Reviewer who knows LangGraph may ask "why not?"

## Alternatives considered  
- **LangGraph**: ✅ battle-tested, free LangSmith; ❌ 6h learning curve, streaming to custom React Flow requires unwrapping, +25MB deps  
- **CrewAI**: ✅ persona-style looks good; ❌ persona pattern doesn't fit tool-shaped pipeline  
- **AutoGen**: ✅ Microsoft-backed; ❌ conversation-loop oriented, not DAG oriented

## Verdict flips if  
DAG grows beyond ~10 nodes with conditional edges and human-in-the-loop checkpoints.

## How to defend in interview (25 seconds)  
"I considered LangGraph. For 5 nodes with no conditional edges, the wrapper overhead would have obscured the partial-output streaming I need for the live UI visualizer. I implemented the same topological execution pattern in my Visual Workflow Orchestrator, so the risk was zero. If this grew to 20 nodes with branches and human-in-the-loop, I'd switch."