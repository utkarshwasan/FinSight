from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
import uuid
import json
from typing import Optional
from app.api.deps import CurrentUser, DBDep
from app import models
from app.db import AsyncSessionLocal
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
    """
    Background DAG execution.
    Creates its OWN DB session — never uses the request-scoped session
    which is already closed by the time this runs.
    """
    try:
        async with AsyncSessionLocal() as bg_db:
            from app.services.audit_writer import AuditWriter
            audit_writer = AuditWriter(bg_db, user_id)

            async def on_event(event_data: dict):
                await ws_hub.publish_to_user(user_id, event_data)

            executor = DAGExecutor(
                nodes=DAG_NODES, on_event=on_event, audit_writer=audit_writer
            )

            initial_state = {
                "run_id": run_id,
                "user_id": user_id,
                "symbol": request.symbol,
                "query": request.query,
                "at_timestamp": request.at_timestamp,
                # Give agents access to DB via session factory (NOT request-scoped session)
                "_session_factory": AsyncSessionLocal,
                # Initial empty values
                "market_data": None,
                "news": None,
                "forecast": None,
                "risk_score": None,
                "alert_triggered": None,
                "answer": None,
                "errors": {},
                "skipped": [],
            }

            final_state = await executor.run(initial_state)

        # CitationGuard pass on final answer
        from app.services.citation_guard import CitationGuard
        answer_text = (final_state.get("answer") or "").strip()
        if not answer_text:
            answer_text = f"[no answer generated — see audit log for run_id={run_id}]"
        validated_answer = CitationGuard.sanitize(answer_text)

        await ws_hub.publish_to_user(
            user_id,
            {
                "type": "query_complete",
                "run_id": run_id,
                "answer": validated_answer,
                "sources": final_state.get("sources") or [],
                "disclaimer": "Educational use only — not financial advice.",
                "degraded": bool(
                    final_state.get("errors") or final_state.get("skipped")
                ),
            },
        )

    except Exception as e:
        import logging
        logger = logging.getLogger("finsight")
        logger.exception(f"DAG background failed for run_id={run_id}")
        await ws_hub.publish_to_user(
            user_id,
            {
                "type": "query_complete",
                "run_id": run_id,
                "answer": f"[error] Analysis pipeline failed. Please retry. (run_id={run_id})",
                "sources": [],
                "disclaimer": "Educational use only — not financial advice.",
                "degraded": True,
            },
        )


@router.post("/", response_model=QueryResponse, status_code=202)
async def submit_query(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DBDep,
):
    run_id = str(uuid.uuid4())

    # Log query submission to audit (request-scoped db is fine here)
    audit_event = models.AuditEvent(
        user_id=current_user.id,
        event_type="dag_query",
        payload=json.dumps({"query": request.query, "run_id": run_id}),
    )
    db.add(audit_event)
    await db.commit()

    # Background task creates its own session — db is NOT passed
    background_tasks.add_task(run_dag_background, run_id, current_user.id, request)
    return {"run_id": run_id}
