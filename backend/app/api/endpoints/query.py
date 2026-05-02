from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uuid
import json
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import CurrentUser, DBDep
from app import models
from app.db import get_db
from app.agents.executor import DAGExecutor
from app.agents import DAG_NODES
from app.services.ws_hub import ws_hub

router = APIRouter()


class QueryRequest(BaseModel):
    query: str
    symbol: str
    at_timestamp: Optional[str] = None


class QueryResponse(BaseModel):
    run_id: str


async def run_dag_background(run_id: str, user_id: int, request: QueryRequest):
    # WS callback
    async def on_event(event_data: dict):
        await ws_hub.publish_to_user(user_id, event_data)

    executor = DAGExecutor(nodes=DAG_NODES, on_event=on_event)

    initial_state = {
        "run_id": run_id,
        "user_id": user_id,
        "symbol": request.symbol,
        "query": request.query,
        "at_timestamp": request.at_timestamp,
        "market_data": None,
        "news": None,
        "forecast": None,
        "risk_score": None,
        "alert_triggered": None,
        "answer": None,
    }

    final_state = await executor.run(initial_state)

    # Validate citations before sending answer
    from app.services.citation_guard import CitationGuard

    answer_text = final_state.get("answer", "")
    validated_answer = CitationGuard.sanitize(answer_text)

    # Send final answer over WS
    await on_event(
        {
            "type": "dag_event",
            "node": "Synthesis",
            "status": "done",
            "run_id": run_id,
            "partial_output": validated_answer,
        }
    )


@router.post("/", response_model=QueryResponse, status_code=202)
async def submit_query(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DBDep,
):
    run_id = str(uuid.uuid4())

    # Log audit event
    audit_event = models.AuditEvent(
        user_id=current_user.id,
        event_type="dag_query",
        payload=json.dumps({"query": request.query, "run_id": run_id}),
    )
    db.add(audit_event)
    await db.commit()

    background_tasks.add_task(run_dag_background, run_id, current_user.id, request)
    return {"run_id": run_id}
