import { useState, useEffect } from 'react';
import client from '../api/client';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Activity,
  Cpu,
  BarChart2,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Sliders,
  Zap
} from 'lucide-react';

/**
 * MlForecastModal — Machine Learning Time-Series Forecasting & Diagnostics Panel.
 * Features:
 *  - Supervised Multi-Variate Ridge Regression
 *  - Statistical 95% Confidence Interval Envelope
 *  - Model Evaluation Metrics: MAE, RMSE, R² Score, Directional Accuracy %
 *  - Computational Latency Benchmark (< 3ms inference)
 *  - Feature Importance & Weight Vector Distribution
 */
export default function MlForecastModal({
  isOpen,
  onClose,
  sessionId = null,
  symbol = 'EURUSD',
  timeframe = 1,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (sessionId) {
        res = await client.get(`/MlForecast/replay/${sessionId}?timeframeMinutes=${timeframe}`);
      } else {
        res = await client.get(`/MlForecast/live?symbol=${symbol}&timeframeMinutes=${timeframe}`);
      }
      setData(res.data);
    } catch (err) {
      console.error('ML Inference failed:', err);
      setError('Failed to compute ML model inference. Ensure the API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchForecast();
    }
  }, [isOpen, sessionId, symbol, timeframe]);

  if (!isOpen) return null;

  const isBullish = data?.direction === 'Bullish';
  const isBearish = data?.direction === 'Bearish';
  const signalColor = isBullish
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40'
    : isBearish
    ? 'text-rose-400 border-rose-500/40 bg-rose-950/40'
    : 'text-amber-400 border-amber-500/40 bg-amber-950/40';

  const formatPrice = (p) => {
    if (!p) return '—';
    const num = Number(p);
    return symbol?.includes('JPY') ? num.toFixed(3) : (num > 500 ? num.toFixed(2) : num.toFixed(5));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden my-auto animate-in fade-in duration-200">
        
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center shadow-inner">
              <Brain className="text-purple-400 animate-pulse" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  AI Time-Series Forecasting & Model Diagnostics
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  L2-Ridge Regression
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Supervised Multi-Variate Inference on {data?.symbol ?? symbol} · {data?.trainingSampleSize ?? 150} Observations Trained
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchForecast}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer disabled:opacity-50"
              title="Re-run Gradient Descent & Inference"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-purple-400' : ''} />
              Re-Train & Predict
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Content Body ── */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-950/60 border border-red-800 rounded-lg text-red-300">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* ── Top Row: Signal, Probability Gauge & Target Envelope ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. Model Signal & Direction */}
            <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Predicted Direction & Signal
              </span>
              <div className="my-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold font-mono ${signalColor}`}>
                  {isBullish ? <TrendingUp size={16} /> : isBearish ? <TrendingDown size={16} /> : <Activity size={16} />}
                  {data?.signal ?? 'Analyzing...'}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Market Trend Bias: <span className="font-semibold text-white">{data?.direction ?? '—'}</span>
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                <span>Inference Latency:</span>
                <span className="font-mono text-purple-400 font-bold flex items-center gap-1">
                  <Zap size={11} /> {data?.inferenceLatencyMs ?? 0} ms
                </span>
              </div>
            </div>

            {/* 2. Directional Probability Distribution */}
            <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Directional Probability
              </span>
              <div className="space-y-2 my-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">▲ Bullish: {data?.bullishProbability ?? 50}%</span>
                  <span className="text-rose-400 font-bold">▼ Bearish: {data?.bearishProbability ?? 50}%</span>
                </div>
                {/* Probability Bar */}
                <div className="h-3 bg-rose-950/80 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${data?.bullishProbability ?? 50}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Calibrated Sigmoid Output over Feature Matrix
              </p>
            </div>

            {/* 3. Expected Price & 95% Confidence Interval */}
            <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Predicted Price & 95% CI Envelope
              </span>
              <div className="my-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-white">
                    {formatPrice(data?.predictedPrice)}
                  </span>
                  <span className={`text-xs font-mono font-bold ${isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-slate-400'}`}>
                    {data?.predictedPrice && data?.currentPrice
                      ? `${(((Number(data.predictedPrice) - Number(data.currentPrice)) / Number(data.currentPrice)) * 100).toFixed(3)}%`
                      : '0.00%'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Upper (95% CI):</span>
                    <span className="text-emerald-400/90">{formatPrice(data?.confidenceIntervalUpper)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lower (95% CI):</span>
                    <span className="text-rose-400/90">{formatPrice(data?.confidenceIntervalLower)}</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-right border-t border-slate-800/80 pt-1">
                Current: {formatPrice(data?.currentPrice)}
              </p>
            </div>

          </div>

          {/* ── Model Evaluation Metrics ── */}
          <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="text-purple-400" size={16} />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Model Performance & Loss Validation Metrics
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Loss Function: Mean Squared Error (MSE) + L2 Regularization
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Mean Absolute Error (MAE)</p>
                <p className="text-lg font-bold font-mono text-purple-300 mt-1">
                  {data?.mae !== undefined ? Number(data.mae).toFixed(6) : '—'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Average absolute residual error</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Root Mean Sq Error (RMSE)</p>
                <p className="text-lg font-bold font-mono text-indigo-300 mt-1">
                  {data?.rmse !== undefined ? Number(data.rmse).toFixed(6) : '—'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Penalizes large outlier residuals</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">R² Score (Goodness of Fit)</p>
                <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {data?.rSquared !== undefined ? Number(data.rSquared).toFixed(3) : '—'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Variance explained by features</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Directional Accuracy %</p>
                <p className="text-lg font-bold font-mono text-sky-400 mt-1">
                  {data?.directionalAccuracy !== undefined ? `${data.directionalAccuracy}%` : '—'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Sign match on out-of-sample data</p>
              </div>
            </div>
          </div>

          {/* ── Feature Importance & Weight Vector Breakdown ── */}
          <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="text-purple-400" size={16} />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Engineered Feature Vector & Normalized Model Weights
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Weights fitted via Batch Gradient Descent with Momentum
              </span>
            </div>

            <div className="space-y-2">
              {data?.featureWeights?.map((feat, idx) => {
                const absWeight = Math.min(100, Math.abs(feat.normalizedWeight));
                const isPos = feat.normalizedWeight >= 0;

                return (
                  <div key={idx} className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                    <span className="w-40 font-mono text-slate-300 font-semibold truncate">
                      {feat.name}
                    </span>
                    <span className="w-20 text-[11px] font-mono text-slate-400 text-right">
                      val: {feat.value}
                    </span>
                    
                    {/* Visual weight bar */}
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex items-center">
                      <div
                        className={`h-full rounded-full ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${absWeight}%` }}
                      />
                    </div>

                    <span className={`w-16 font-mono font-bold text-right text-xs ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPos ? '+' : ''}{feat.normalizedWeight}%
                    </span>

                    <span className={`w-20 text-[10px] font-semibold px-2 py-0.5 rounded text-center border ${
                      feat.impact === 'Bullish'
                        ? 'text-emerald-400 border-emerald-900 bg-emerald-950/40'
                        : feat.impact === 'Bearish'
                        ? 'text-rose-400 border-rose-900 bg-rose-950/40'
                        : 'text-slate-400 border-slate-800 bg-slate-900'
                    }`}>
                      {feat.impact}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Target Timeframe: {timeframe}m · Symbol: {symbol}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
          >
            Close Panel
          </button>
        </div>

      </div>
    </div>
  );
}
