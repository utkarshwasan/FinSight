import { useEffect, useRef } from "react";
import type {
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickData,
  LineData,
} from "lightweight-charts";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  LineStyle,
} from "lightweight-charts";

export default function CandleChart({
  data,
  forecast,
  symbol,
}: {
  data: CandlestickData<Time>[];
  forecast?: LineData<Time>[];
  symbol: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const forecastSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.5)" },
        horzLines: { color: "rgba(30, 41, 59, 0.5)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: "rgba(30, 41, 59, 0.5)",
        timeVisible: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    if (data && data.length > 0) {
      candleSeries.setData(data);
    }
    candleSeriesRef.current =
      candleSeries as unknown as ISeriesApi<"Candlestick">;

    if (forecast && forecast.length > 0) {
      const forecastSeries = chart.addSeries(LineSeries, {
        color: "#818cf8",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
      });
      forecastSeries.setData(forecast);
      forecastSeriesRef.current =
        forecastSeries as unknown as ISeriesApi<"Line">;
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, forecast]);

  return (
    <div className="relative w-full">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          {symbol}
          <span className="text-xs font-normal text-slate-500 uppercase tracking-widest">
            Real-time Chart
          </span>
        </h3>
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
