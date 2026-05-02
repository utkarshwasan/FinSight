# backend/tests/test_dag.py

import asyncio
import pytest
from app.agents.executor import DAGExecutor


@pytest.mark.asyncio
async def test_fail_open():
    events = []

    async def cap(e):
        events.append(e)

    async def good(state):
        state["market_data"] = {"latest_price": 100}

    async def bad(state):
        raise RuntimeError("boom")

    async def alert(state):
        state["answer"] = "[degraded] alert ok"

    ex = DAGExecutor(
        nodes={
            "MarketData": bad,
            "News": good,
            "Forecast": good,
            "Risk": good,
            "Alert": alert,
        },
        on_event=cap,
    )
    state = {
        "run_id": "t1",
        "user_id": 1,
        "symbol": "X",
        "query": "?",
        "errors": {},
        "skipped": [],
    }
    result = await ex.run(state)
    statuses = {e["node"]: e["status"] for e in events if e["type"] == "dag_event"}
    assert statuses["MarketData"] == "error"
    assert statuses["News"] == "skipped"
    assert "[degraded]" in result.get("answer", "")
