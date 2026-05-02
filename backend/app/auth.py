import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from bcrypt import hashpw, gensalt, checkpw

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def _get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if not secret or secret == "your-secret-key-change-in-production":
        raise RuntimeError(
            "JWT_SECRET is unset or using default. Generate one: "
            "python -c 'import secrets; print(secrets.token_urlsafe(48))'"
        )
    return secret


def create_access_token(*, user_id: int, email: str) -> str:
    """Single source of truth for JWT issuance."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=ALGORITHM)


def get_password_hash(password: str) -> str:
    # Cost factor 12 as per requirements
    return hashpw(password.encode("utf-8"), gensalt(12)).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
