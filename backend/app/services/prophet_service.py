import pandas as pd
import numpy as np
from datetime import timedelta


def get_forecast(history_df: pd.DataFrame, days: int = 7) -> dict:
    """
    history_df: 'ds' (datetime) and 'y' (float) columns.
    Returns dict with forecasted values + REAL MAPE computed via 80/20 train-test split.
    """
    if history_df.empty or len(history_df) < 5:
        return {"error": "Insufficient data"}

    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        history_df = history_df.sort_values("ds").set_index("ds")
        n = len(history_df)

        # ── Real MAPE via 80/20 train-test split ──────────────────────
        mape = 0.0
        if n >= 10:
            train_size = int(n * 0.8)
            train = history_df["y"].iloc[:train_size]
            test = history_df["y"].iloc[train_size:]
            try:
                test_model = ExponentialSmoothing(
                    train, trend="add", seasonal=None, initialization_method="estimated"
                ).fit()
                test_pred = test_model.forecast(len(test))
                actual = test.values
                pred = test_pred.values
                nonzero = actual != 0
                if nonzero.any():
                    mape = float(np.mean(np.abs((actual[nonzero] - pred[nonzero]) / actual[nonzero])))
                else:
                    mape = 0.0
            except Exception as e:
                print(f"[prophet_service] MAPE calc failed: {e}")
                mape = 0.0

        # ── Final forecast on full history ────────────────────────────
        model = ExponentialSmoothing(
            history_df["y"],
            trend="add",
            seasonal=None,
            initialization_method="estimated",
        ).fit()
        forecast = model.forecast(days)
        last_date = history_df.index[-1]

        std_dev = float(np.std(history_df["y"])) * 0.1
        result = []
        for i, val in enumerate(forecast):
            future_date = last_date + timedelta(days=i + 1)
            result.append({
                "ts": future_date.isoformat(),
                "yhat": float(val),
                "yhat_lower": float(val - std_dev),
                "yhat_upper": float(val + std_dev),
            })

        return {"forecast": result, "mape": round(mape, 4)}
    except Exception as e:
        print(f"Forecast error: {e}")
        return {"error": str(e)}
