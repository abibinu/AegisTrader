import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';

const TradingChart = ({ data, trades = [] }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);

    // Effect 1: Mount the chart ONCE and clean it up on unmount.
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0f172a' },
                textColor: '#94a3b8',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
            },
            width: chartContainerRef.current.clientWidth,
            height: 520,
            grid: {
                vertLines: { color: '#1e293b' },
                horzLines: { color: '#1e293b' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#334155',
                rightOffset: 5,
            },
            rightPriceScale: {
                borderColor: '#334155',
            },
            crosshair: {
                vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
                horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
            },
        });

        // ✅ v5 API: import CandlestickSeries and pass to addSeries()
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        chartRef.current = chart;
        seriesRef.current = candleSeries;

        // ResizeObserver is better than window.onresize — it fires only when
        // THIS container changes size, not the entire window.
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !chartContainerRef.current) return;
            chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    // Effect 2: Update the chart data whenever the `data` prop changes.
    // This is separate from Effect 1 so we don't recreate the chart on every data update.
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        // Map backend JSON shape → Lightweight Charts shape
        // Backend sends: { timestamp, open, high, low, close }
        // Chart needs:   { time (Unix seconds), open, high, low, close }
        const formattedData = data
            .map(c => ({
                // Handles both camelCase (c.timestamp) and PascalCase (c.Timestamp)
                time: Math.floor(new Date(c.timestamp ?? c.Timestamp).getTime() / 1000),
                open: Number(c.open ?? c.Open),
                high: Number(c.high ?? c.High),
                low: Number(c.low ?? c.Low),
                close: Number(c.close ?? c.Close),
            }))
            .sort((a, b) => a.time - b.time); // Must be sorted ascending for LW Charts

        seriesRef.current.setData(formattedData);
        chartRef.current.timeScale().fitContent();
    }, [data]);

    return (
        <div
            ref={chartContainerRef}
            className="w-full rounded-xl overflow-hidden"
            id="trading-chart-container"
        />
    );
};

export default TradingChart;