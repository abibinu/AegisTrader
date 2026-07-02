import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import {
  TrendingUp, TrendingDown, BarChart2, Target,
  AlertTriangle, ArrowLeft, RefreshCw, Trophy,
} from "lucide-react";

// ─── Metric Card ──────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, subValue, icon: Icon, color = "text-white", bg = "bg-slate-900", description }) => (
  <div className={`${bg} rounded-xl border border-slate-800 p-5 flex flex-col gap-3`}>
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">{label}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800`}>
        <Icon size={15} className={color} />
      </div>
    </div>
    <div>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
    </div>
    {description && (
      <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-800 pt-2">
        {description}
      </p>
    )}
  </div>
);

// ─── Win Rate Circle ──────────────────────────────────────────────────────────
const WinRateGauge = ({ winRate, total, wins, losses }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (winRate / 100) * circumference;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col items-center gap-3">
      <span className="text-xs text-slate-500 uppercase tracking-widest font-medium self-start">Win Rate</span>
      <div className="relative">
        <svg width="110" height="110" viewBox="0 0 110 110">
          {/* Background track */}
          <circle cx="55" cy="55" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
          {/* Progress arc */}
          <circle
            cx="55" cy="55" r={radius} fill="none"
            stroke={winRate >= 50 ? "#22c55e" : "#ef4444"}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold font-mono ${winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
            {winRate.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-green-400">▲ {wins} wins</span>
        <span className="text-red-400">▼ {losses} losses</span>
      </div>
      <p className="text-xs text-slate-600 text-center">{total} total trades closed</p>
    </div>
  );
};

// ─── Main Analytics Page ──────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { sessionId } = useParams(); // Comes from URL: /analytics/:sessionId
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!sessionId) {
      setError("No session ID in URL. Navigate here from the replay engine.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await client.get(`/Trade/analytics/${sessionId}`);
      setSummary(res.data);
    } catch (err) {
      setError(`Failed to load analytics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={18} className="animate-spin" />
          Loading session analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-red-400 bg-red-950/40 border border-red-800 rounded-xl p-8 max-w-md">
          <AlertTriangle size={32} className="mx-auto mb-3" />
          <p>{error}</p>
          <Link to="/replay" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
            ← Go to Replay Engine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6 py-3 flex items-center gap-4">
        <Link to="/replay" className="text-slate-400 hover:text-white transition">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">
          Aegis<span className="text-blue-400">Trader</span>
          <span className="ml-2 text-sm font-normal text-slate-400">Session Analytics</span>
        </h1>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition">
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {summary?.totalTrades === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Trophy size={40} className="mx-auto mb-4 text-slate-700" />
            <p className="text-lg font-medium">No closed trades yet</p>
            <p className="text-sm mt-1">Place some trades and let them close to see analytics.</p>
            <Link to="/replay" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
              ← Back to Replay Engine
            </Link>
          </div>
        ) : (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total P&L"
                value={`${summary.totalPnL >= 0 ? "+" : ""}$${Number(summary.totalPnL).toFixed(2)}`}
                subValue={`Initial: $${Number(summary.initialBalance).toFixed(0)}`}
                icon={summary.totalPnL >= 0 ? TrendingUp : TrendingDown}
                color={summary.totalPnL >= 0 ? "text-green-400" : "text-red-400"}
                description="Net profit or loss across all closed trades in this session."
              />
              <MetricCard
                label="Profit Factor"
                value={summary.profitFactor === 0 ? "N/A" : Number(summary.profitFactor).toFixed(2)}
                subValue="Gross Profit ÷ Gross Loss"
                icon={BarChart2}
                color={summary.profitFactor >= 1 ? "text-blue-300" : "text-red-400"}
                description="A PF above 1.5 is considered solid. Above 2.0 is excellent."
              />
              <MetricCard
                label="Max Drawdown"
                value={`$${Number(summary.maxDrawdown).toFixed(2)}`}
                subValue={`${Number(summary.maxDrawdownPercent).toFixed(1)}% of peak equity`}
                icon={AlertTriangle}
                color="text-amber-400"
                description="Worst peak-to-trough equity drop. Lower is better."
              />
              <MetricCard
                label="Current Balance"
                value={`$${Number(summary.currentBalance).toFixed(2)}`}
                subValue={`${summary.totalTrades} trades closed`}
                icon={Target}
                color="text-white"
              />
            </div>

            {/* Win Rate + Breakdown Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <WinRateGauge
                winRate={Number(summary.winRate)}
                total={summary.totalTrades}
                wins={summary.winningTrades}
                losses={summary.losingTrades}
              />

              {/* Gross Profit vs Loss breakdown */}
              <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5">
                <h3 className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-4">
                  Profit vs Loss Breakdown
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-green-400 font-medium">Gross Profit</span>
                      <span className="font-mono text-green-400">+${Number(summary.grossProfit).toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{
                          width: summary.grossProfit + summary.grossLoss > 0
                            ? `${(summary.grossProfit / (summary.grossProfit + summary.grossLoss)) * 100}%`
                            : "0%"
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-red-400 font-medium">Gross Loss</span>
                      <span className="font-mono text-red-400">-${Number(summary.grossLoss).toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-700"
                        style={{
                          width: summary.grossProfit + summary.grossLoss > 0
                            ? `${(summary.grossLoss / (summary.grossProfit + summary.grossLoss)) * 100}%`
                            : "0%"
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expectancy */}
                <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Avg Win</p>
                    <p className="text-sm font-mono font-bold text-green-400">
                      +${summary.winningTrades > 0 ? (summary.grossProfit / summary.winningTrades).toFixed(2) : "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Avg Loss</p>
                    <p className="text-sm font-mono font-bold text-red-400">
                      -${summary.losingTrades > 0 ? (summary.grossLoss / summary.losingTrades).toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Session ID footer */}
            <p className="text-xs text-slate-700 text-center">
              Session ID: <span className="font-mono">{sessionId}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
