import os
import random
import json
import asyncio
import hashlib
import time
from typing import Optional

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"

# 5-minute in-process LRU cache keyed by MD5(prompt)
_CACHE_TTL = 300  # seconds
_cache: dict[str, tuple[float, str]] = {}  # key -> (expiry_ts, response)


def _cache_get(key: str) -> Optional[str]:
    entry = _cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    if entry:
        del _cache[key]
    return None


def _cache_set(key: str, value: str) -> None:
    # Evict oldest entry if cache exceeds 128 items
    if len(_cache) >= 128:
        oldest = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest]
    _cache[key] = (time.monotonic() + _CACHE_TTL, value)


class GeminiClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not DEMO_MODE and not self.api_key:
            print("Warning: GEMINI_API_KEY not set. Operating in DEMO_MODE fallback.")

    async def generate_content(self, prompt: str) -> str:
        if DEMO_MODE or not self.api_key:
            # Fixtures for demo mode — check risk BEFORE sentiment (risk prompts contain "sentiment" too)
            if "risk" in prompt.lower():
                score = round(random.uniform(0.1, 0.9), 2)
                return json.dumps(
                    {"risk_score": score, "reasoning": "Demo risk reasoning"}
                )
            if "sentiment" in prompt.lower():
                score = round(random.uniform(-0.8, 0.8), 2)
                return json.dumps(
                    {"sentiment_score": score, "summary": "Demo sentiment summary"}
                )
            return "This is a synthesized demo response from the AI. The market looks interesting today! [1]"

        # Check cache first
        cache_key = hashlib.md5(prompt.encode()).hexdigest()
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        def call_gemini():
            from google import genai

            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            return response.text

        for attempt in range(5):
            try:
                result = await asyncio.to_thread(call_gemini)
                _cache_set(cache_key, result)
                return result
            except Exception as e:
                if attempt < 4:
                    wait_time = 5.0 * (2**attempt)
                    print(f"Gemini error (attempt {attempt+1}/5): {e}. Waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Gemini error after final retry: {e}")
                    # Check risk BEFORE sentiment — risk prompts contain the word "sentiment"
                    if "risk" in prompt.lower():
                        return json.dumps({"risk_score": 0.5, "reasoning": "AI temporarily unavailable"})
                    if "sentiment" in prompt.lower():
                        return json.dumps({"sentiment_score": 0.0, "summary": "AI temporarily unavailable"})
                    return "AI temporarily unavailable; analysis based on available market data only."


gemini_client = GeminiClient()
