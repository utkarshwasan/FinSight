import os
import random
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
                return f"{{'sentiment_score': {random.uniform(-0.8, 0.8):.2f}, 'summary': 'Demo sentiment summary based on headlines.'}}"
            if "risk" in prompt.lower():
                return f"{{'risk_score': {random.uniform(0.1, 0.9):.2f}, 'reasoning': 'Demo risk reasoning.'}}"
            return "This is a synthesized demo response from the AI. The market looks interesting today! [1]"
            
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
            )
            return response.text
        except Exception as e:
            print(f"Gemini error: {e}")
            return "Error calling AI."

gemini_client = GeminiClient()
