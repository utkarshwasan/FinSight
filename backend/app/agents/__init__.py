from app.agents.market_data import run_market_data_node
from app.agents.news import run_news_node
from app.agents.forecast import run_forecast_node
from app.agents.risk import run_risk_node
from app.agents.alert import run_alert_node

DAG_NODES = {
    "MarketData": run_market_data_node,
    "News": run_news_node,
    "Forecast": run_forecast_node,
    "Risk": run_risk_node,
    "Alert": run_alert_node
}
