import os
import random
import json
import asyncio
from typing import Optional

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"


class GeminiClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not DEMO_MODE and not self.api_key:
            print("Warning: GEMINI_API_KEY not set. Operating in DEMO_MODE fallback.")

    async def generate_content(self, prompt: str) -> str:
        if DEMO_MODE or not self.api_key:
            # Fixtures for demo mode
            if "sentiment" in prompt.lower():
                score = round(random.uniform(-0.8, 0.8), 2)
                return json.dumps(
                    {"sentiment_score": score, "summary": "Demo sentiment summary"}
                )
            if "risk" in prompt.lower():
                score = round(random.uniform(0.1, 0.9), 2)
                return json.dumps(
                    {"risk_score": score, "reasoning": "Demo risk reasoning"}
                )
            return "This is a synthesized demo response from the AI. The market looks interesting today! [1]"

        async def call_gemini():
            from google import genai

            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            return response.text

        for attempt in range(3):
            try:
                return await asyncio.to_thread(call_gemini)
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(1.0 * (2**attempt))
                else:
                    print(f"Gemini error after retries: {e}")
                    # Return valid JSON so downstream parsers in news/risk get sane defaults
                    if "sentiment" in prompt.lower():
                        return json.dumps({"sentiment_score": 0.0, "summary": "AI temporarily unavailable"})
                    if "risk" in prompt.lower():
                        return json.dumps({"risk_score": 0.5, "reasoning": "AI temporarily unavailable"})
                    return "AI temporarily unavailable; analysis based on available market data only."


gemini_client = GeminiClient()
