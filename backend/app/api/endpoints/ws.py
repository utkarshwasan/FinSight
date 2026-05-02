import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from app.auth import _get_jwt_secret, ALGORITHM
from app.services.ws_hub import ws_hub

router = APIRouter()


def _decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except (JWTError, ValueError, TypeError):
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    user_id = _decode_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    q = ws_hub.connect(user_id)

    try:
        while True:
            event = await q.get()
            await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        pass
    finally:
        ws_hub.disconnect(user_id, q)
