import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, createSeriesMarkers } from 'lightweight-charts';
import { Globe } from 'lucide-react';

/**
 * Premium TradingChart component using Lightweight Charts v5.
 * Overhauled to resemble a professional TradingView chart:
 *  - High-precision Candlestick series with custom ICT/SMC styling
 *  - ICT / SMC Kill Zone Session indicators (Asian Range, London Kill Zone, New York Kill Zone)
 *  - 20-period Simple Moving Average (SMA) technical indicator overlay
 *  - Volume histogram subchart with synthetic fallback for zero-volume datasets
 *  - Custom HUD legend showing candle O, H, L, C, V, price change %, SMA, & active session
 */
const TIMEFRAMES = [
    { label: '1m',  value: 1   },
    { label: '5m',  value: 5   },
    { label: '15m', value: 15  },
    { label: '1H',  value: 60  },
    { label: '4H',  value: 240 },
];

const getActiveSessionInfo = (utcHour) => {
    if (utcHour >= 0 && utcHour < 6) {
        return { name: 'ASIAN RANGE', color: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/80', badge: '🌐 Asian' };
    }
    if (utcHour >= 7 && utcHour < 10) {
        return { name: 'LONDON KILL ZONE', color: 'text-sky-400 bg-sky-950/60 border-sky-800/80', badge: '🇬🇧 London KZ' };
    }
    if (utcHour >= 13 && utcHour < 16) {
        return { name: 'NEW YORK KILL ZONE', color: 'text-amber-400 bg-amber-950/60 border-amber-800/80', badge: '🇺🇸 New York KZ' };
    }
    if (utcHour >= 16 && utcHour < 18) {
        return { name: 'LONDON CLOSE', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80', badge: '🌆 London Close' };
    }
    return { name: 'OFF-PEAK SESSION', color: 'text-slate-400 bg-slate-900/60 border-slate-800/80', badge: '🌙 Off-Peak' };
};

const TradingChart = ({ data, trades = [], timeframe = 1, onTimeframeChange }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const smaRef = useRef(null);
    const volumeRef = useRef(null);
    const markersApiRef = useRef(null);
    const priceLinesRef = useRef([]);
    const initialScrollDoneRef = useRef(false);
    const prevTimeframeRef = useRef(timeframe);

    // Toggle for Kill Zone session visual overlay
    const [showKillZones, setShowKillZones] = useState(true);

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
                vertLines: { color: '#1e293b', style: 3 },
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
                    bottom: 0.28,
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
            color: '#f59e0b',
            lineWidth: 1.5,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });

        // 3. Volume histogram series overlay initialization
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume-scale',
        });

        chart.priceScale('volume-scale').applyOptions({
            visible: false,
            scaleMargins: {
                top: 0.78,
                bottom: 0,
            },
        });

        chartRef.current = chart;
        seriesRef.current = candleSeries;
        smaRef.current = smaSeries;
        volumeRef.current = volumeSeries;

        markersApiRef.current = createSeriesMarkers(candleSeries);

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

                const utcDate = new Date(param.time * 1000);
                const sessionInfo = getActiveSessionInfo(utcDate.getUTCHours());

                setHudData({
                    open: cData.open,
                    high: cData.high,
                    low: cData.low,
                    close: cData.close,
                    volume: vData ? vData.value : 0,
                    change: diff,
                    changePercent: pct,
                    sma: sData ? sData.value : null,
                    session: sessionInfo
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

        const formattedVolume = data
            .map(c => {
                const openVal = Number(c.open ?? c.Open);
                const highVal = Number(c.high ?? c.High);
                const lowVal = Number(c.low ?? c.Low);
                const closeVal = Number(c.close ?? c.Close);
                const rawVol = Number(c.volume ?? c.Volume ?? 0);
                const timeSec = Math.floor(new Date(c.timestamp ?? c.Timestamp).getTime() / 1000);

                const range = Math.max(0.00001, highVal - lowVal);
                const pseudoHash = (timeSec % 37) + 5;
                const volumeValue = rawVol > 0
                    ? rawVol
                    : Math.floor(range * 180000 + pseudoHash);

                return {
                    time: timeSec,
                    value: volumeValue,
                    color: closeVal >= openVal ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)',
                };
            })
            .sort((a, b) => a.time - b.time);

        seriesRef.current.setData(formattedCandles);
        volumeRef.current.setData(formattedVolume);
        smaRef.current.setData(smaData);

        // Default HUD update
        if (formattedCandles.length > 0 && !hudData) {
            const lastCandle = formattedCandles[formattedCandles.length - 1];
            const lastVolume = formattedVolume[formattedVolume.length - 1];
            const lastSma = smaData.length > 0 ? smaData[smaData.length - 1].value : null;
            const diff = lastCandle.close - lastCandle.open;
            const pct = (diff / lastCandle.open) * 100;
            const utcDate = new Date(lastCandle.time * 1000);
            const sessionInfo = getActiveSessionInfo(utcDate.getUTCHours());
            
            setHudData({
                open: lastCandle.open,
                high: lastCandle.high,
                low: lastCandle.low,
                close: lastCandle.close,
                volume: lastVolume ? lastVolume.value : 0,
                change: diff,
                changePercent: pct,
                sma: lastSma,
                session: sessionInfo
            });
        }

        // Price lines for open trades
        if (priceLinesRef.current) {
            priceLinesRef.current.forEach(line => {
                try {
                    seriesRef.current.removePriceLine(line);
                } catch (e) {
                    console.error("Failed to remove price line:", e);
                }
            });
            priceLinesRef.current = [];
        }

        if (trades && trades.length > 0) {
            trades.forEach(t => {
                const isOpen = t.status === 0 || t.status === 'Open' || t.Status === 0 || t.Status === 'Open' || t.Status === 'open' || t.status === 'open';
                if (isOpen) {
                    const stopLoss = Number(t.sl ?? t.StopLoss ?? t.stopLoss ?? 0);
                    const takeProfit = Number(t.tp ?? t.TakeProfit ?? t.takeProfit ?? 0);

                    if (stopLoss > 0) {
                        const slLine = seriesRef.current.createPriceLine({
                            price: stopLoss,
                            color: '#ef4444',
                            lineWidth: 1,
                            lineStyle: 1,
                            axisLabelVisible: true,
                            title: `SL: ${stopLoss.toFixed(5)}`,
                        });
                        priceLinesRef.current.push(slLine);
                    }

                    if (takeProfit > 0) {
                        const tpLine = seriesRef.current.createPriceLine({
                            price: takeProfit,
                            color: '#10b981',
                            lineWidth: 1,
                            lineStyle: 1,
                            axisLabelVisible: true,
                            title: `TP: ${takeProfit.toFixed(5)}`,
                        });
                        priceLinesRef.current.push(tpLine);
                    }
                }
            });
        }

        // Execution markers
        if (markersApiRef.current) {
            if (trades && trades.length > 0) {
                const markers = [];
                const seenIds = new Map();
                trades.forEach(t => {
                    const existing = seenIds.get(t.id);
                    if (!existing || t.status === 'Closed' || t.status === 1) {
                        seenIds.set(t.id, t);
                    }
                });
                const uniqueTrades = Array.from(seenIds.values());

                uniqueTrades.forEach(t => {
                    const openTime = t.openedAt ?? t.OpenedAt;
                    if (!openTime) return;
                    const openTimeSec = Math.floor(new Date(openTime).getTime() / 1000);
                    if (isNaN(openTimeSec)) return;

                    const isBuy = t.direction === 0 || t.direction === 'Buy';
                    const entryPrice = Number(t.entryPrice ?? t.EntryPrice ?? t.entry ?? 0);

                    markers.push({
                        time: openTimeSec,
                        position: isBuy ? 'belowBar' : 'aboveBar',
                        color: isBuy ? '#10b981' : '#ef4444',
                        shape: isBuy ? 'arrowUp' : 'arrowDown',
                        text: isBuy ? `BUY @ ${entryPrice.toFixed(5)}` : `SELL @ ${entryPrice.toFixed(5)}`,
                    });

                    if (t.status === 1 || t.status === 'Closed') {
                        const closeTime = t.closedAt ?? t.ClosedAt;
                        if (!closeTime) return;
                        const closeTimeSec = Math.floor(new Date(closeTime).getTime() / 1000);
                        if (isNaN(closeTimeSec)) return;

                        const isWin = Number(t.pnl ?? t.pnL ?? 0) > 0;
                        const exitPrice = Number(t.exitPrice ?? t.ExitPrice ?? t.exit ?? 0);
                        
                        markers.push({
                            time: closeTimeSec,
                            position: isBuy ? 'aboveBar' : 'belowBar',
                            color: isWin ? '#10b981' : '#ef4444',
                            shape: 'circle',
                            text: `EXIT @ ${exitPrice.toFixed(5)} (${isWin ? '+' : ''}${Number(t.pnl ?? t.pnL ?? 0).toFixed(2)})`,
                        });
                    }
                });

                markers.sort((a, b) => a.time - b.time);
                markersApiRef.current.setMarkers(markers);
            } else {
                markersApiRef.current.setMarkers([]);
            }
        }

        if (!initialScrollDoneRef.current || prevTimeframeRef.current !== timeframe) {
            initialScrollDoneRef.current = true;
            prevTimeframeRef.current = timeframe;
            chartRef.current.timeScale().scrollToPosition(0, false);
        }

    }, [data, trades, timeframe]);

    return (
        <div className="relative w-full rounded-xl overflow-hidden bg-[#090d16] border border-slate-800">
            {/* Chart header: Timeframe switcher + Session Toggle + HUD legend */}
            <div className="flex flex-wrap items-center justify-between px-4 pt-3 pb-1 gap-2 sm:gap-4">
                {/* Timeframe switcher buttons + Kill Zones Toggle */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        {TIMEFRAMES.map(tf => (
                            <button
                                key={tf.value}
                                id={`tf-btn-${tf.label}`}
                                onClick={() => onTimeframeChange && onTimeframeChange(tf.value)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all duration-150 ${
                                    timeframe === tf.value
                                        ? 'bg-blue-600 text-white shadow shadow-blue-900/60'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                {tf.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowKillZones(!showKillZones)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded border transition-all duration-150 ${
                            showKillZones
                                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60 shadow shadow-indigo-950/50'
                                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                        title="Toggle ICT/SMC Kill Zone Session Overlays"
                    >
                        <Globe size={13} />
                        <span>Sessions</span>
                    </button>
                </div>

                {/* HUD Legend */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono bg-slate-950/85 backdrop-blur border border-slate-800/80 px-4 py-1.5 rounded-lg text-slate-400 select-none shadow-lg">
                    {hudData ? (
                        <>
                            {showKillZones && hudData.session && (
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${hudData.session.color}`}>
                                    {hudData.session.badge}
                                </div>
                            )}
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