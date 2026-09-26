import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import {
  TrendingUp, TrendingDown, BarChart2, Target,
  AlertTriangle, ArrowLeft, RefreshCw, Trophy,
  Clock, ShieldAlert, Award, Zap, Calendar, Compass
} from "lucide-react";

// ─── Metric Card ──────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, subValue, icon: Icon, color = "text-white", bg = "bg-slate-900", description }) => (
  <div className={`${bg} rounded-xl border border-slate-800 p-4 sm:p-5 flex flex-col gap-2.5 shadow-md hover:border-slate-700/80 transition`}>
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">{label}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800/80 border border-slate-700/50">
        <Icon size={15} className={color} />
      </div>
    </div>
    <div>
      <p className={`text-xl sm:text-2xl font-bold font-mono ${color}`}>{value}</p>
      {subValue && <p className="text-xs text-slate-400 mt-0.5">{subValue}</p>}
    </div>
    {description && (
      <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-2">
        {description}
      </p>
    )}
  </div>
);

// ─── Win Rate Gauge Circle ──────────────────────────────────────────────────
const WinRateGauge = ({ winRate, total, wins, losses }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (winRate / 100) * circumference;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col items-center justify-between gap-3 shadow-md">
      <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold self-start">Win Rate</span>
      <div className="relative my-1">
        <svg width="115" height="115" viewBox="0 0 115 115">
          <circle cx="57.5" cy="57.5" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="57.5" cy="57.5" r={radius} fill="none"
            stroke={winRate >= 50 ? "#10b981" : "#ef4444"}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 57.5 57.5)"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold font-mono ${winRate >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
            {winRate.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-xs font-medium">
        <span className="text-emerald-400">▲ {wins} Wins</span>
        <span className="text-rose-400">▼ {losses} Losses</span>
      </div>
      <p className="text-[11px] text-slate-500 text-center">{total} Total Trades Closed</p>
    </div>
  );
};

// ─── Session Card ─────────────────────────────────────────────────────────────
const SessionCard = ({ name, badge, stat, color, bg }) => (
  <div className={`bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col justify-between gap-3`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
        <Clock size={13} className={color} /> {name}
      </span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${bg} ${color}`}>
        {badge}
      </span>
    </div>

    {stat.tradeCount === 0 ? (
      <p className="text-xs text-slate-500 py-2 italic">No trades executed in this session</p>
    ) : (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Win Rate:</span>
          <span className={`font-bold ${stat.winRate >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
            {stat.winRate.toFixed(1)}% ({stat.tradeCount} trades)
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Session PnL:</span>
          <span className={`font-bold ${stat.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {stat.totalPnL >= 0 ? "+" : ""}${Number(stat.totalPnL).toFixed(2)}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${stat.winRate >= 50 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, stat.winRate))}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

// ─── Main Analytics Page ──────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { sessionId } = useParams();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!sessionId) {
      setError("No session ID in URL. Navigate here from the replay or live engine.");
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
          <RefreshCw size={18} className="animate-spin text-blue-500" />
          <span>Computing institutional analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-rose-400 bg-rose-950/40 border border-rose-800/80 rounded-xl p-8 max-w-md shadow-xl">
          <AlertTriangle size={32} className="mx-auto mb-3" />
          <p>{error}</p>
          <Link to="/replay" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
            ← Return to Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/replay" className="text-slate-400 hover:text-white transition">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">
            Aegis<span className="text-blue-400">Trader</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60 uppercase tracking-wide">
              Institutional Analytics
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-500 font-mono">Session: {sessionId?.slice(0, 8)}...</span>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

        {summary?.totalTrades === 0 ? (
          <div className="text-center py-20 text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Trophy size={48} className="mx-auto mb-4 text-slate-700" />
            <p className="text-lg font-bold text-slate-300">No Closed Trades Recorded</p>
            <p className="text-sm mt-1 text-slate-500 max-w-md mx-auto">
              Execute trades in Historical Replay or Live Sandbox to generate quantitative session analytics.
            </p>
            <Link to="/replay" className="mt-5 inline-block text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-lg shadow-blue-900/40">
              Launch Replay Engine
            </Link>
          </div>
        ) : (
          <>
            {/* 1. Core Performance Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Realized P&L"
                value={`${summary.totalPnL >= 0 ? "+" : ""}$${Number(summary.totalPnL).toFixed(2)}`}
                subValue={`Initial Balance: $${Number(summary.initialBalance).toFixed(0)}`}
                icon={summary.totalPnL >= 0 ? TrendingUp : TrendingDown}
                color={summary.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}
                description="Net profit or loss across all closed orders."
              />
              <MetricCard
                label="Profit Factor (PF)"
                value={summary.profitFactor === 0 ? "N/A" : Number(summary.profitFactor).toFixed(2)}
                subValue="Gross Profit ÷ Gross Loss"
                icon={BarChart2}
                color={summary.profitFactor >= 1.5 ? "text-emerald-400" : summary.profitFactor >= 1.0 ? "text-blue-400" : "text-rose-400"}
                description="Target PF > 1.5 indicates institutional edge."
              />
              <MetricCard
                label="Sharpe Ratio"
                value={Number(summary.sharpeRatio).toFixed(2)}
                subValue={`Sortino: ${Number(summary.sortinoRatio).toFixed(2)}`}
                icon={Award}
                color={summary.sharpeRatio >= 1.0 ? "text-indigo-400" : "text-amber-400"}
                description="Risk-adjusted return. Sharpe > 1.0 is benchmark solid."
              />
              <MetricCard
                label="Max Drawdown"
                value={`$${Number(summary.maxDrawdown).toFixed(2)}`}
                subValue={`${Number(summary.maxDrawdownPercent).toFixed(1)}% of peak equity`}
                icon={AlertTriangle}
                color="text-amber-400"
                description="Worst peak-to-trough capital decline."
              />
            </div>

            {/* 2. Institutional Expectancy & Win Rate Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <WinRateGauge
                winRate={Number(summary.winRate)}
                total={summary.totalTrades}
                wins={summary.winningTrades}
                losses={summary.losingTrades}
              />

              {/* Expectancy & Gross Profit Breakdown */}
              <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                    Trade Expectancy & Risk Metrics
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                    Expectancy: ${Number(summary.expectancy).toFixed(2)} / trade
                  </span>
                </div>

                {/* Progress bars */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-mono">
                      <span className="text-emerald-400 font-bold">Gross Profit</span>
                      <span className="text-emerald-400 font-bold">+${Number(summary.grossProfit).toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                        style={{
                          width: summary.grossProfit + summary.grossLoss > 0
                            ? `${(summary.grossProfit / (summary.grossProfit + summary.grossLoss)) * 100}%`
                            : "0%"
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-mono">
                      <span className="text-rose-400 font-bold">Gross Loss</span>
                      <span className="text-rose-400 font-bold">-${Number(summary.grossLoss).toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-700"
                        style={{
                          width: summary.grossProfit + summary.grossLoss > 0
                            ? `${(summary.grossLoss / (summary.grossProfit + summary.grossLoss)) * 100}%`
                            : "0%"
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Avg Win/Loss & Streaks */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Avg Win</p>
                    <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                      +${Number(summary.avgWin).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Avg Loss</p>
                    <p className="text-sm font-mono font-bold text-rose-400 mt-0.5">
                      -${Number(summary.avgLoss).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Risk:Reward (RRR)</p>
                    <p className="text-sm font-mono font-bold text-blue-400 mt-0.5">
                      1 : {Number(summary.avgRiskRewardRatio).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Max Streaks</p>
                    <p className="text-xs font-mono font-bold text-slate-300 mt-0.5">
                      <span className="text-emerald-400">{summary.maxConsecutiveWins}W</span> / <span className="text-rose-400">{summary.maxConsecutiveLosses}L</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. ICT / SMC Kill Zone Sessions Breakdown */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-indigo-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                  ICT / SMC Session Performance (Kill Zones)
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SessionCard
                  name="Asian Range"
                  badge="00:00 - 06:00 UTC"
                  stat={summary.asianSession}
                  color="text-indigo-400"
                  bg="bg-indigo-950/60 border-indigo-800/80"
                />
                <SessionCard
                  name="London Kill Zone"
                  badge="07:00 - 10:00 UTC"
                  stat={summary.londonKillZone}
                  color="text-sky-400"
                  bg="bg-sky-950/60 border-sky-800/80"
                />
                <SessionCard
                  name="New York Kill Zone"
                  badge="13:00 - 16:00 UTC"
                  stat={summary.newYorkKillZone}
                  color="text-amber-400"
                  bg="bg-amber-950/60 border-amber-800/80"
                />
              </div>
            </div>

            {/* 4. Directional Bias & Day of Week Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Directional Bias Card */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <Compass size={14} className="text-blue-400" /> Directional Bias
                  </span>
                </div>
                <div className="space-y-4 my-2">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-400">LONG (BUY) TRADES</p>
                      <p className="text-[11px] text-slate-500">{summary.longTradesCount} Trades Executed</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-sm font-bold text-emerald-400">{summary.longWinRate.toFixed(1)}% Win Rate</p>
                      <p className="text-xs text-slate-400">{summary.longPnL >= 0 ? "+" : ""}${Number(summary.longPnL).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-rose-400">SHORT (SELL) TRADES</p>
                      <p className="text-[11px] text-slate-500">{summary.shortTradesCount} Trades Executed</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-sm font-bold text-rose-400">{summary.shortWinRate.toFixed(1)}% Win Rate</p>
                      <p className="text-xs text-slate-400">{summary.shortPnL >= 0 ? "+" : ""}${Number(summary.shortPnL).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Day of Week Heatmap Grid */}
              <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <Calendar size={14} className="text-amber-400" /> Day-of-Week Performance Heatmap
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {summary.dayOfWeekPerformance?.map((d) => (
                    <div key={d.dayName} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between text-center gap-1">
                      <span className="text-xs font-bold text-slate-300">{d.dayName.slice(0, 3)}</span>
                      {d.tradeCount === 0 ? (
                        <span className="text-[10px] text-slate-600 italic my-2">No Trades</span>
                      ) : (
                        <>
                          <span className={`text-sm font-mono font-bold my-1 ${d.winRate >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
                            {d.winRate.toFixed(0)}%
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {d.totalPnL >= 0 ? "+" : ""}${Number(d.totalPnL).toFixed(0)} ({d.tradeCount})
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;

