import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, createSeriesMarkers } from 'lightweight-charts';

/**
 * Premium TradingChart component using Lightweight Charts v5.
 * Overhauled to resemble a professional TradingView chart:
 *  - High-precision Candlestick series with custom ICT/SMC styling
 *  - 20-period Simple Moving Average (SMA) technical indicator overlay
 *  - Volume histogram subchart with synthetic fallback for zero-volume datasets
 *  - Custom HUD legend showing candle O, H, L, C, V, price change %, and SMA
 *  - Dotted grid lines and TV-style scale margins
 */
const TradingChart = ({ data, trades = [] }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const smaRef = useRef(null);
    const volumeRef = useRef(null);
    const markersApiRef = useRef(null);

    // Local HUD state for hover values
    const [hudData, setHudData] = useState(null);

    // Effect 1: Initialize chart, series and resize handler
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#090d16' },
                textColor: '#94a3b8',
                fontFamily: "'Outfit', 'Inter', 'Segoe UI', sans-serif",
                fontSize: 11,
            },
            width: chartContainerRef.current.clientWidth,
            height: 520,
            grid: {
                vertLines: { color: '#1e293b', style: 3 }, // 3 is dotted style
                horzLines: { color: '#1e293b', style: 3 },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#1e293b',
                rightOffset: 12,
                barSpacing: 8,
                minBarSpacing: 4,
            },
            rightPriceScale: {
                borderColor: '#1e293b',
                autoScale: true,
                scaleMargins: {
                    top: 0.12,
                    bottom: 0.28, // Leave bottom 28% for volume overlay
                },
            },
            crosshair: {
                vertLine: { color: '#3b82f6', labelBackgroundColor: '#1e3a8a', width: 1, style: 3 },
                horzLine: { color: '#3b82f6', labelBackgroundColor: '#1e3a8a', width: 1, style: 3 },
            },
        });

        // 1. Candlestick series initialization
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
            priceLineColor: '#3b82f6',
            priceLineWidth: 1,
            priceLineStyle: 2,
        });

        // 2. SMA Line indicator series initialization
        const smaSeries = chart.addSeries(LineSeries, {
            color: '#f59e0b', // Amber/Gold color
            lineWidth: 1.5,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });

        // 3. Volume histogram series overlay initialization
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume-scale',
        });

        // Configure separate vertical price scale for volume and hide its axis labels
        chart.priceScale('volume-scale').applyOptions({
            visible: false, // Hide vertical axis for volume to prevent clutter
            scaleMargins: {
                top: 0.78, // volume series takes up bottom 22% of chart
                bottom: 0,
            },
        });

        chartRef.current = chart;
        seriesRef.current = candleSeries;
        smaRef.current = smaSeries;
        volumeRef.current = volumeSeries;

        // Initialize v5 Markers API for the candlestick series
        markersApiRef.current = createSeriesMarkers(candleSeries);

        // Auto-resize on container size changes
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !chartContainerRef.current) return;
            chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        });
        resizeObserver.observe(chartContainerRef.current);

        // Crosshair move subscription for Custom HUD/Legend values
        chart.subscribeCrosshairMove((param) => {
            if (
                param.time &&
                param.seriesData.has(candleSeries)
            ) {
                const cData = param.seriesData.get(candleSeries);
                const vData = param.seriesData.get(volumeSeries);
                const sData = param.seriesData.get(smaSeries);
                
                const openVal = cData.open;
                const closeVal = cData.close;
                const diff = closeVal - openVal;
                const pct = (diff / openVal) * 100;

                setHudData({
                    open: cData.open,
                    high: cData.high,
                    low: cData.low,
                    close: cData.close,
                    volume: vData ? vData.value : 0,
                    change: diff,
                    changePercent: pct,
                    sma: sData ? sData.value : null
                });
            } else {
                setHudData(null);
            }
        });

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
            smaRef.current = null;
            volumeRef.current = null;
            markersApiRef.current = null;
        };
    }, []);

    // Effect 2: Update series data and format when new data arrives
    useEffect(() => {
        if (!seriesRef.current || !volumeRef.current || !smaRef.current || !data || data.length === 0) return;

        // Map and sort raw candles
        const formattedCandles = data
            .map(c => ({
                time: Math.floor(new Date(c.timestamp ?? c.Timestamp).getTime() / 1000),
                open: Number(c.open ?? c.Open),
                high: Number(c.high ?? c.High),
                low: Number(c.low ?? c.Low),
                close: Number(c.close ?? c.Close),
            }))
            .sort((a, b) => a.time - b.time);

        // Calculate 20-period SMA technical indicator
        const smaData = [];
        for (let i = 0; i < formattedCandles.length; i++) {
            if (i >= 19) {
                let sum = 0;
                for (let j = 0; j < 20; j++) {
                    sum += formattedCandles[i - j].close;
                }
                smaData.push({
                    time: formattedCandles[i].time,
                    value: sum / 20
                });
            }
        }

        // Map volume dataset (generating synthetic tick volume based on spread if volume is 0)
        const formattedVolume = data
            .map(c => {
                const openVal = Number(c.open ?? c.Open);
                const closeVal = Number(c.close ?? c.Close);
                const rawVol = Number(c.volume ?? c.Volume ?? 0);
                
                // If database volume is 0, generate synthetic tick volume (forex-style correlation)
                const volumeValue = rawVol > 0
                    ? rawVol
                    : Math.floor(Math.abs(closeVal - openVal) * 150000 + Math.random() * 25 + 5);

                return {
                    time: Math.floor(new Date(c.timestamp ?? c.Timestamp).getTime() / 1000),
                    value: volumeValue,
                    // Semitransparent fill: Green volume if candle is bullish, red if bearish
                    color: closeVal >= openVal ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)',
                };
            })
            .sort((a, b) => a.time - b.time);

        seriesRef.current.setData(formattedCandles);
        volumeRef.current.setData(formattedVolume);
        smaRef.current.setData(smaData);

        // Update latest candle close in default HUD view
        if (formattedCandles.length > 0 && !hudData) {
            const lastCandle = formattedCandles[formattedCandles.length - 1];
            const lastVolume = formattedVolume[formattedVolume.length - 1];
            const lastSma = smaData.length > 0 ? smaData[smaData.length - 1].value : null;
            const diff = lastCandle.close - lastCandle.open;
            const pct = (diff / lastCandle.open) * 100;
            
            setHudData({
                open: lastCandle.open,
                high: lastCandle.high,
                low: lastCandle.low,
                close: lastCandle.close,
                volume: lastVolume ? lastVolume.value : 0,
                change: diff,
                changePercent: pct,
                sma: lastSma
            });
        }

        // Execution markers plotting
        if (markersApiRef.current) {
            if (trades && trades.length > 0) {
                const markers = [];

                trades.forEach(t => {
                    const openTimeSec = Math.floor(new Date(t.openedAt ?? t.OpenedAt).getTime() / 1000);
                    const isBuy = t.direction === 0 || t.direction === 'Buy';

                    // Plot Entry Marker
                    markers.push({
                        time: openTimeSec,
                        position: isBuy ? 'belowBar' : 'aboveBar',
                        color: isBuy ? '#10b981' : '#ef4444',
                        shape: isBuy ? 'arrowUp' : 'arrowDown',
                        text: isBuy ? `BUY @ ${Number(t.entryPrice).toFixed(5)}` : `SELL @ ${Number(t.entryPrice).toFixed(5)}`,
                    });

                    // Plot Exit Marker if trade is Closed
                    if (t.status === 1 || t.status === 'Closed') {
                        const closeTimeSec = Math.floor(new Date(t.closedAt ?? t.ClosedAt).getTime() / 1000);
                        const isWin = Number(t.pnl ?? t.pnL ?? 0) > 0;
                        markers.push({
                            time: closeTimeSec,
                            position: isBuy ? 'aboveBar' : 'belowBar',
                            color: isWin ? '#10b981' : '#ef4444',
                            shape: 'circle',
                            text: `EXIT @ ${Number(t.exitPrice).toFixed(5)} (${isWin ? '+' : ''}${Number(t.pnl ?? t.pnL ?? 0).toFixed(2)})`,
                        });
                    }
                });

                // Sort markers by time
                markers.sort((a, b) => a.time - b.time);
                markersApiRef.current.setMarkers(markers);
            } else {
                markersApiRef.current.setMarkers([]);
            }
        }

        // Scroll to the end to keep latest candle visible
        chartRef.current.timeScale().scrollToPosition(0, true);

    }, [data, trades]);

    return (
        <div className="relative w-full rounded-xl overflow-hidden bg-[#090d16] border border-slate-800">
            {/* Custom Interactive HUD / Legend overlay */}
            <div className="absolute top-3 left-4 z-10 flex flex-wrap gap-3 sm:gap-4 text-xs font-mono bg-slate-950/85 backdrop-blur border border-slate-800/80 px-4 py-2.5 rounded-lg text-slate-400 select-none shadow-lg">
                {hudData ? (
                    <>
                        <div>O <span className="text-white ml-0.5">{hudData.open.toFixed(5)}</span></div>
                        <div>H <span className="text-white ml-0.5">{hudData.high.toFixed(5)}</span></div>
                        <div>L <span className="text-white ml-0.5">{hudData.low.toFixed(5)}</span></div>
                        <div>C <span className="text-white ml-0.5">{hudData.close.toFixed(5)}</span></div>
                        <div>V <span className="text-white ml-0.5">{hudData.volume.toLocaleString()}</span></div>
                        {hudData.sma && (
                            <div className="text-amber-400 font-semibold">
                                SMA(20) <span className="ml-0.5">{hudData.sma.toFixed(5)}</span>
                            </div>
                        )}
                        <div className={hudData.change >= 0 ? "text-emerald-400 font-semibold" : "text-rose-500 font-semibold"}>
                            {hudData.change >= 0 ? '+' : ''}{hudData.change.toFixed(5)} ({hudData.changePercent.toFixed(2)}%)
                        </div>
                    </>
                ) : (
                    <span className="text-slate-500">Hover over chart to view tick data</span>
                )}
            </div>

            {/* TradingView Lightweight Charts target container */}
            <div
                ref={chartContainerRef}
                className="w-full"
                id="trading-chart-container"
            />
        </div>
    );
};

export default TradingChart;