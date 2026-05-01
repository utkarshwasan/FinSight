import asyncio
from collections import defaultdict
from typing import Any
import json


class WSHub:
    """Per-user asyncio.Queue pubsub hub."""

    def __init__(self):
        self._queues: dict[int, list[asyncio.Queue]] = defaultdict(list)

    def connect(self, user_id: int) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues[user_id].append(q)
        return q

    def disconnect(self, user_id: int, q: asyncio.Queue):
        try:
            self._queues[user_id].remove(q)
        except ValueError:
            pass

    async def publish_to_user(self, user_id: int, event: dict[str, Any]):
        for q in list(self._queues.get(user_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # drop if client is slow

    async def broadcast(self, event: dict[str, Any]):
        """Broadcast to ALL connected users."""
        for user_id in list(self._queues.keys()):
            await self.publish_to_user(user_id, event)


# Singleton
ws_hub = WSHub()
