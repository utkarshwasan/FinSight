from typing import TypedDict, Optional, Any
from datetime import datetime


class AgentState(TypedDict, total=False):
    run_id: str
    user_id: int
    symbol: str
    query: str
    at_timestamp: Optional[str]

    # Outputs from nodes
    market_data: Optional[dict[str, Any]]
    news: Optional[list[dict[str, Any]]]
    forecast: Optional[dict[str, Any]]
    risk_score: Optional[float]
    alert_triggered: Optional[bool]

    # Final synthesized answer
    answer: Optional[str]

    # Fail-open tracking
    errors: dict[str, str]
    skipped: list[str]

    # Internal
    sources: Optional[list[dict[str, Any]]]
