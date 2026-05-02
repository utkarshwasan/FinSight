import asyncio
from typing import Callable, Awaitable, Any
from datetime import datetime, timezone
import time
from app.agents.state import AgentState

# Node signature: async def run(state: AgentState) -> AgentState
NodeCallable = Callable[[AgentState], Awaitable[AgentState]]


def _approx_tokens(text: str | None) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)  # rough chars/4 heuristic for Gemini flash


class DAGExecutor:
    def __init__(
        self,
        nodes: dict[str, NodeCallable],
        on_event: Callable[[dict[str, Any]], Awaitable[None]],
    ):
        self.nodes = nodes
        self.on_event = on_event

    async def _run_node(self, name: str, state: AgentState) -> None:
        started = datetime.now(timezone.utc).isoformat()
        await self.on_event(
            {
                "type": "dag_event",
                "node": name,
                "status": "running",
                "run_id": state["run_id"],
                "started_at": started,
            }
        )
        t0 = time.perf_counter()
        try:
            node_fn = self.nodes[name]
            await node_fn(state)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            partial = self._extract_partial(name, state)
            await self.on_event(
                {
                    "type": "dag_event",
                    "node": name,
                    "status": "done",
                    "run_id": state["run_id"],
                    "started_at": started,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "latency_ms": elapsed_ms,
                    "tokens": _approx_tokens(partial),
                    "partial_output": (partial or "")[:200],
                }
            )
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            await self.on_event(
                {
                    "type": "dag_event",
                    "node": name,
                    "status": "error",
                    "run_id": state["run_id"],
                    "started_at": started,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "latency_ms": elapsed_ms,
                    "tokens": 0,
                    "partial_output": "",
                    "error_msg": str(e)[:200],
                }
            )
            raise

    def _extract_partial(self, name: str, state: AgentState) -> str:
        if name == "MarketData":
            md = state.get("market_data") or {}
            return f"latest=${md.get('latest_price', 0):.2f}"
        if name == "News":
            items = state.get("news") or []
            return f"{len(items)} headlines, sentiment={state.get('sentiment', 0):.2f}"
        if name == "Forecast":
            f = state.get("forecast") or {}
            if "error" in f:
                return f"error: {f['error']}"
            rows = f.get("forecast", [])
            return f"{len(rows)} day projection, mape={f.get('mape', 0):.2f}"
        if name == "Risk":
            return f"risk_score={state.get('risk_score', 0):.2f}"
        if name == "Alert":
            ans = state.get("answer") or ""
            return ans[:200]
        return ""

    async def _safe_run(
        self, name: str, state: AgentState, required: bool = False
    ) -> bool:
        if name not in self.nodes:
            return False
        started = datetime.now(timezone.utc).isoformat()
        await self.on_event(
            {
                "type": "dag_event",
                "node": name,
                "status": "running",
                "run_id": state["run_id"],
                "started_at": started,
            }
        )
        t0 = time.perf_counter()
        try:
            await self.nodes[name](state)
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            state["errors"][name] = str(e)[:200]
            await self.on_event(
                {
                    "type": "dag_event",
                    "node": name,
                    "status": "error",
                    "run_id": state["run_id"],
                    "started_at": started,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "latency_ms": elapsed_ms,
                    "tokens": 0,
                    "partial_output": "",
                    "error_msg": str(e)[:200],
                }
            )
            return False
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        partial = self._extract_partial(name, state)
        await self.on_event(
            {
                "type": "dag_event",
                "node": name,
                "status": "done",
                "run_id": state["run_id"],
                "started_at": started,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "latency_ms": elapsed_ms,
                "tokens": _approx_tokens(partial),
                "partial_output": (partial or "")[:200],
            }
        )
        return True

    async def _mark_skipped(self, names: list[str], state: AgentState) -> None:
        for n in names:
            state["skipped"].append(n)
            await self.on_event(
                {
                    "type": "dag_event",
                    "node": n,
                    "status": "skipped",
                    "run_id": state["run_id"],
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "latency_ms": 0,
                    "tokens": 0,
                    "partial_output": "",
                }
            )

    async def run(self, state: AgentState) -> AgentState:
        state.setdefault("errors", {})
        state.setdefault("skipped", [])

        # Stage 1: MarketData
        ok = await self._safe_run("MarketData", state, required=True)
        if not ok:
            await self._mark_skipped(["News", "Forecast", "Risk", "Alert"], state)
            state["answer"] = "[degraded] MarketData fetch failed; downstream skipped."
            return state

        # Stage 2: News || Forecast
        results = await asyncio.gather(
            self._safe_run("News", state),
            self._safe_run("Forecast", state),
            return_exceptions=False,
        )
        # Even if one fails, the other completes (return_exceptions handled inside _safe_run).

        # Stage 3: Risk (depends on News, Forecast — runs even if one upstream failed)
        await self._safe_run("Risk", state)

        # Stage 4: Alert (always runs; produces a degradation-aware answer)
        await self._safe_run("Alert", state)

        return state
