"""
llm_client (exported as gemini_client for backward compatibility).

Provider priority:
  1. Groq  — if GROQ_API_KEY is set (llama-3.3-70b-versatile, 1 000 RPD free)
  2. Gemini — if GEMINI_API_KEY is set (gemini-2.0-flash, 1 500 RPD free)
  3. Demo fixtures — if neither key is present or DEMO_MODE=1

Groq API reference: https://console.groq.com/docs/openai
Gemini API reference: https://ai.google.dev/api/generate-content
"""

import os
import random
import json
import asyncio
import hashlib
import httpx
import time
from typing import Optional

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"

# ── In-process LRU cache (5-min TTL, max 128 entries) ────────────────────────
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
    if len(_cache) >= 128:
        oldest = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest]
    _cache[key] = (time.monotonic() + _CACHE_TTL, value)


# ── Provider constants ────────────────────────────────────────────────────────
_GROQ_MODEL = "llama-3.3-70b-versatile"
_GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
_GEMINI_MODEL = "gemini-2.0-flash"


class GeminiClient:
    """
    Provider-agnostic LLM client.
    Uses Groq as primary (if GROQ_API_KEY set), Gemini as fallback.
    Kept as 'GeminiClient' for import compatibility with existing callers.
    """

    def __init__(self) -> None:
        self.groq_key: str = os.getenv("GROQ_API_KEY", "")
        self.gemini_key: str = os.getenv("GEMINI_API_KEY", "")

        if not DEMO_MODE:
            if self.groq_key:
                print(f"[LLM] Provider: Groq ({_GROQ_MODEL}) — 1 000 RPD free tier")
            elif self.gemini_key:
                print(f"[LLM] Provider: Gemini ({_GEMINI_MODEL}) — fallback")
            else:
                print("[LLM] Warning: no API key set. Operating in demo fixture mode.")

    # ── Public interface (unchanged from original) ────────────────────────────

    async def generate_content(self, prompt: str) -> str:
        """Generate LLM content. Cached, with exponential-backoff retry."""
        # Demo / no-key fixture replay
        if DEMO_MODE or (not self.groq_key and not self.gemini_key):
            return self._demo_fixture(prompt)

        cache_key = hashlib.md5(prompt.encode()).hexdigest()
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        if self.groq_key:
            result = await self._call_groq(prompt)
        else:
            result = await self._call_gemini(prompt)

        _cache_set(cache_key, result)
        return result

    # ── Provider implementations ──────────────────────────────────────────────

    async def _call_groq(self, prompt: str) -> str:
        """
        Call Groq's OpenAI-compatible chat completions endpoint via httpx.
        Docs: https://console.groq.com/docs/openai
        """
        for attempt in range(5):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        _GROQ_BASE_URL,
                        headers={
                            "Authorization": f"Bearer {self.groq_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": _GROQ_MODEL,
                            "messages": [{"role": "user", "content": prompt}],
                            "max_tokens": 400,
                            "temperature": 0.3,
                        },
                    )
                    # 429 = rate limit — back off and retry
                    if resp.status_code == 429:
                        wait = 5.0 * (2**attempt)
                        print(
                            f"[Groq] 429 rate limit (attempt {attempt + 1}/5). "
                            f"Waiting {wait}s..."
                        )
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]

            except Exception as e:
                if attempt < 4:
                    wait = 5.0 * (2**attempt)
                    print(
                        f"[Groq] error (attempt {attempt + 1}/5): {e}. "
                        f"Waiting {wait}s..."
                    )
                    await asyncio.sleep(wait)
                else:
                    print(f"[Groq] error after final retry: {e}")

        return self._fallback_response(prompt)

    async def _call_gemini(self, prompt: str) -> str:
        """
        Fallback: Gemini 2.0 Flash via google-genai SDK (sync, run in thread).
        Docs: https://ai.google.dev/api/generate-content
        """
        def _sync_call() -> str:
            from google import genai

            client = genai.Client(api_key=self.gemini_key)
            response = client.models.generate_content(
                model=_GEMINI_MODEL,
                contents=prompt,
            )
            return response.text

        for attempt in range(5):
            try:
                result = await asyncio.to_thread(_sync_call)
                return result
            except Exception as e:
                if attempt < 4:
                    wait = 5.0 * (2**attempt)
                    print(
                        f"[Gemini] error (attempt {attempt + 1}/5): {e}. "
                        f"Waiting {wait}s..."
                    )
                    await asyncio.sleep(wait)
                else:
                    print(f"[Gemini] error after final retry: {e}")

        return self._fallback_response(prompt)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _demo_fixture(self, prompt: str) -> str:
        """Return deterministic fixture data — no real API call."""
        # Check risk BEFORE sentiment: risk prompts contain the word "sentiment"
        if "risk" in prompt.lower():
            score = round(random.uniform(0.1, 0.9), 2)
            return json.dumps({"risk_score": score, "reasoning": "Demo risk reasoning"})
        if "sentiment" in prompt.lower():
            score = round(random.uniform(-0.8, 0.8), 2)
            return json.dumps({"sentiment_score": score, "summary": "Demo sentiment"})
        return "This is a synthesized demo response from the AI. The market looks interesting today! [1]"

    def _fallback_response(self, prompt: str) -> str:
        """Safe static fallback when all LLM attempts fail."""
        if "risk" in prompt.lower():
            return json.dumps(
                {"risk_score": 0.5, "reasoning": "AI temporarily unavailable"}
            )
        if "sentiment" in prompt.lower():
            return json.dumps(
                {"sentiment_score": 0.0, "summary": "AI temporarily unavailable"}
            )
        return "AI temporarily unavailable; analysis based on available market data only."


# Singleton — imported everywhere as `from app.services.gemini_client import gemini_client`
gemini_client = GeminiClient()
