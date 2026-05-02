import asyncio
from typing import Callable, Awaitable, Any
from datetime import datetime, timezone
import time
from app.agents.state import AgentState

# Node signature: async def run(state: AgentState) -> AgentState
NodeCallable = Callable[[AgentState], Awaitable[AgentState]]


class DAGExecutor:
    def __init__(
        self,
        nodes: dict[str, NodeCallable],
        on_event: Callable[[dict[str, Any]], Awaitable[None]],
    ):
        self.nodes = nodes
        self.on_event = on_event

    async def _run_node(self, node_name: str, state: AgentState) -> AgentState:
        started_at = datetime.now(timezone.utc).isoformat()
        start_time = time.time()

        await self.on_event(
            {
                "type": "dag_event",
                "node": node_name,
                "status": "running",
                "run_id": state["run_id"],
                "started_at": started_at,
            }
        )

        try:
            state = await self.nodes[node_name](state)

            ended_at = datetime.now(timezone.utc).isoformat()
            latency_ms = int((time.time() - start_time) * 1000)

            await self.on_event(
                {
                    "type": "dag_event",
                    "node": node_name,
                    "status": "done",
                    "run_id": state["run_id"],
                    "started_at": started_at,
                    "ended_at": ended_at,
                    "latency_ms": latency_ms,
                    "tokens": 0,  # TODO: integrate actual token counting
                }
            )
            return state
        except Exception as e:
            ended_at = datetime.now(timezone.utc).isoformat()
            await self.on_event(
                {
                    "type": "dag_event",
                    "node": node_name,
                    "status": "error",
                    "run_id": state["run_id"],
                    "error_msg": str(e),
                    "started_at": started_at,
                    "ended_at": ended_at,
                }
            )
            raise

    async def run(self, state: AgentState) -> AgentState:
        # Hardcoded DAG topology
        # MarketData -> [News, Forecast] -> Risk -> Alert

        try:
            # Level 1: Market Data
            if "MarketData" in self.nodes:
                state = await self._run_node("MarketData", state)

            # Level 2: News & Forecast (Parallel)
            tasks = []
            if "News" in self.nodes:
                tasks.append(self._run_node("News", state))
            if "Forecast" in self.nodes:
                tasks.append(self._run_node("Forecast", state))

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, Exception):
                        # Mark the failing node as error in state["errors"]; do NOT raise (fail-open per §5).
                        # Identify which task failed by parallel ordering of tasks list.
                        continue
                    if isinstance(res, dict):
                        state.update(res)  # ← THE ONE LINE THAT UNBLOCKS THE DAG

            # Level 3: Risk
            if "Risk" in self.nodes:
                state = await self._run_node("Risk", state)

            # Level 4: Alert
            if "Alert" in self.nodes:
                state = await self._run_node("Alert", state)

        except Exception as e:
            print(f"DAG execution failed: {e}")
            # Further error handling can be done here.

        return state
