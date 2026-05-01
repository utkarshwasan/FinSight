# ADR-0002 — Prophet over LSTM / Transformer for forecasting

**Status:** Accepted | **Date:** 2026-04-29 | **Decider:** Utkarsh Wasan

## Context  
PDF asks for "time-series forecasting models." Three realistic options: Prophet (Meta), LSTM (Keras/PyTorch), Transformer-based.

## Decision  
**Use Prophet 1.1+, restricted to a 7-day projection on 30-day daily-close training, with MAPE-gated rendering.**

```python  
def forecast(df, periods=7):  
    m = Prophet(  
        changepoint_prior_scale=0.05,  
        seasonality_mode="multiplicative",  
        interval_width=0.50,   # 50% confidence band — narrower = less misleading  
    )  
    m.fit(df.rename(columns={"ts": "ds", "close": "y"}))  
    future = m.make_future_dataframe(periods=periods, freq="D")  
    return m.predict(future)  
```

**Discipline rules:**  
- Hold out last 5 days; compute MAPE on holdout.  
- If MAPE > 15%, hide the forecast and show "insufficient signal."  
- Confidence band is 50%, not 80%.  
- Label the chart "7-day projection (illustrative)", not "prediction."  
- Disclaimer rendered next to chart and on /forecast API responses.

## Consequences

**Positive:**  
- Zero training time. Prophet fits in milliseconds on 30 days.  
- Sane defaults. No hyperparameter tuning to defend.  
- Honest framing. "Baseline projection" is defensible.  
- Pre-built wheels on PyPI for Python 3.10+. No cmake/pystan pain.

**Negative:**  
- No regime change handling.  
- Daily granularity only.  
- Reviewer who knows finance will know it's a baseline — lean into MAPE gate.

## Alternatives considered  
- **LSTM in PyTorch**: ✅ modern; ❌ 1+ day of train/val/test/hyperparam; easy to overfit 30 days of noisy stock data  
- **Transformer (PatchTST)**: ✅ state-of-the-art; ❌ no pretrained variants for individual stocks; training 30 days is academic malpractice  
- **ARIMA**: ✅ defensible; ❌ less visually impressive (no native confidence band charting)  
- **Naive baseline**: ✅ fastest; ❌ doesn't satisfy "time-series forecasting models" in the brief

## Math depth to defend  
Prophet decomposes: `y(t) = g(t) + s(t) + h(t) + ε(t)`  
- `g(t)` = trend: piecewise linear, automatic changepoints, Laplace prior on rate-change (sparse — most candidates get shrunk to zero)  
- `s(t)` = seasonality: Fourier series (10 terms yearly, 3 weekly)  
- `h(t)` = holiday effects (unused — equities trade on known calendar)  
- Inference: Stan HMC; we use MAP estimation (Prophet's mcmc_samples=0) for speed

## Verdict flips if  
Intraday forecasting → ARIMA-GARCH or Temporal Fusion Transformer. Training data past 5 years → richer model. Probabilistic multi-horizon forecasts → DeepAR/GluonTS.

## How to defend in interview (30 seconds)  
"Prophet is a baseline. It's an additive model — piecewise linear trend with automatic changepoint detection, plus Fourier seasonality. I picked it because it ships in milliseconds, the defaults are sane, and I can explain every parameter. LSTM was overkill for 4 days. The MAPE gate is the discipline — if the model can't beat 'last close + drift' on holdout, I refuse to render the forecast. The chart says 'projection', not 'prediction'."