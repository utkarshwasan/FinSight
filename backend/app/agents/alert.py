from app.agents.state import AgentState
from app.services.gemini_client import gemini_client

async def run_alert_node(state: AgentState) -> AgentState:
    risk_score = state.get("risk_score", 0.0)
    
    # Simple alert logic
    state["alert_triggered"] = risk_score > 0.8
    
    # Synthesize final answer
    symbol = state["symbol"]
    query = state["query"]
    
    prompt = f"""
    The user asked: "{query}" about {symbol}.
    
    Here is the analysis data:
    Risk Score: {risk_score}
    Forecast Data: {state.get("forecast", {})}
    Sentiment Data: {state.get("news", [])}
    
    Provide a concise, synthesized answer. Include numeric citations like [1] when referencing data.
    """
    
    answer = await gemini_client.generate_content(prompt)
    state["answer"] = answer
    
    return state
