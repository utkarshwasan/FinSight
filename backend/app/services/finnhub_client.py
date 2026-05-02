import os
import httpx
import asyncio
from datetime import datetime, timedelta, timezone

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"


async def _retry_with_backoff(func, max_retries=3, base_delay=1.0):
    for attempt in range(max_retries):
        try:
            return await func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            delay = base_delay * (2**attempt)
            await asyncio.sleep(delay)


class FinnhubClient:
    def __init__(self):
        self.api_key = os.getenv("FINNHUB_API_KEY")

    async def get_company_news(self, symbol: str, days: int = 3) -> list[dict]:
        if DEMO_MODE or not self.api_key:
            return [
                {
                    "headline": f"Demo News 1 for {symbol}",
                    "summary": f"This is a demo summary for {symbol}.",
                    "url": "https://example.com/news1",
                    "datetime": int(datetime.now(timezone.utc).timestamp()),
                    "source": "DemoSource",
                },
                {
                    "headline": f"Demo News 2 for {symbol} drops 5%",
                    "summary": "Another demo headline.",
                    "url": "https://example.com/news2",
                    "datetime": int(
                        (datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()
                    ),
                    "source": "DemoSource",
                },
            ]

        to_date = datetime.now(timezone.utc)
        from_date = to_date - timedelta(days=days)
        url = "https://finnhub.io/api/v1/company-news"
        params = {
            "symbol": symbol,
            "from": from_date.strftime("%Y-%m-%d"),
            "to": to_date.strftime("%Y-%m-%d"),
            "token": self.api_key,
        }

        async def fetch():
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()

        try:
            return await _retry_with_backoff(fetch)
        except Exception as e:
            print(f"Finnhub error after retries: {e}")
            return []


finnhub_client = FinnhubClient()
