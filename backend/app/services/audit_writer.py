from sqlalchemy.ext.asyncio import AsyncSession
from app import models
import json
from datetime import datetime, timezone


class AuditWriter:
    def __init__(self, db: AsyncSession, user_id: int):
        self.db = db
        self.user_id = user_id

    async def log_node(
        self,
        run_id: str,
        node: str,
        status: str,
        latency_ms: int,
        tokens: int,
        error_msg: str | None = None,
    ):
        payload = {
            "run_id": run_id,
            "node": node,
            "status": status,
            "latency_ms": latency_ms,
            "tokens": tokens,
        }
        if error_msg:
            payload["error_msg"] = error_msg

        event = models.AuditEvent(
            user_id=self.user_id,
            event_type="dag_node",
            payload=json.dumps(payload),
        )
        self.db.add(event)
        await self.db.commit()
