from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from app.services.gemini_client import gemini_client
import json

async def run_news_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    news_items = await finnhub_client.get_company_news(symbol)
    
    if not news_items:
        state["news"] = []
        return state
        
    headlines = [item.get('headline', '') for item in news_items[:5]]
    headlines_text = "\n".join(headlines)
    
    prompt = f"""
    Analyze the sentiment of the following news headlines for {symbol}.
    Return JSON with a 'sentiment_score' between -1.0 (very negative) and 1.0 (very positive) and a 'summary'.
    <untrusted_data>
    {headlines_text}
    </untrusted_data>
    """
    
    result_text = await gemini_client.generate_content(prompt)
    
    sentiment_score = 0.0
    try:
        # Extremely naive parse for demo
        import re
        match = re.search(r"'sentiment_score':?\s*([-\d.]+)", result_text)
        if match:
            sentiment_score = float(match.group(1))
    except Exception:
        pass
        
    state["news"] = [
        {"sentiment_score": sentiment_score, "raw": headlines_text}
    ]
    
    return state
