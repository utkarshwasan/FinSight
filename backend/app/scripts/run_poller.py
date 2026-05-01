"""Worker entry point: python -m app.scripts.run_poller"""
import asyncio
import os
import sys

# Default watchlist for demo
DEFAULT_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "BTC-USD"]


async def main():
    from app.services.quote_poller import poll_loop
    symbols = os.getenv("POLL_SYMBOLS", ",".join(DEFAULT_SYMBOLS)).split(",")
    print(f"Poller starting. Symbols: {symbols}")
    await poll_loop(symbols)


if __name__ == "__main__":
    asyncio.run(main())
