import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import TradingChart from "../components/TradingChart";
import {
  Play,
  FastForward,
  TrendingUp,
  TrendingDown,
  Clock,
  Wallet,
  Activity,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart2,
} from "lucide-react";

// ─── Small helper components ──────────────────────────────────────────────────

/** A single card in the stats bar */
const StatCard = ({ label, value, color = "text-white", icon: Icon }) => (
  <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
    {Icon && <Icon size={16} className="text-slate-500" />}
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
    </div>
  </div>
);

/** A single row in the trade history table */
const TradeRow = ({ trade }) => {
  const isWin = trade.pnl > 0;
  const isOpen = trade.status === 0 || trade.status === "Open";

  return (
    <tr className="border-t border-slate-800 hover:bg-slate-800/50 transition-colors">
      <td className="py-2 px-3">
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            trade.direction === 0 || trade.direction === "Buy"
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {trade.direction === 0 || trade.direction === "Buy" ? "▲ BUY" : "▼ SELL"}
        </span>
      </td>
      <td className="py-2 px-3 font-mono text-xs text-slate-300">
        {Number(trade.entryPrice).toFixed(5)}
      </td>
      <td className="py-2 px-3 font-mono text-xs text-slate-400">
        {Number(trade.stopLoss).toFixed(5)}
      </td>
      <td className="py-2 px-3 font-mono text-xs text-slate-400">
        {Number(trade.takeProfit).toFixed(5)}
      </td>
      <td className="py-2 px-3">
        {isOpen ? (
          <span className="text-xs text-blue-400 font-semibold animate-pulse">OPEN</span>
        ) : (
          <span
            className={`text-xs font-bold font-mono ${
              isWin ? "text-green-400" : "text-red-400"
            }`}
          >
            {isWin ? "+" : ""}
            {Number(trade.pnl).toFixed(2)}
          </span>
        )}
      </td>
      <td className="py-2 px-3">
        {isOpen ? (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Activity size={10} className="animate-pulse" /> Live
          </span>
        ) : isWin ? (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle size={10} /> Win
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <XCircle size={10} /> Loss
          </span>
        )}
      </td>
    </tr>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────────

const ReplayPage = () => {
  // ── State ──────────────────────────────────────────────────────────────────

  // Session state
  const [session, setSession] = useState(null); // Full session object from API
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // DB diagnostic state
  const [dbStatus, setDbStatus] = useState(null);

  // Trade form state
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [lots, setLots] = useState("0.1");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState(null);

  // Trade history state
  const [trades, setTrades] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── API Calls (useCallback prevents stale closure bugs in useEffect) ────────

  /**
   * LEARNING: useCallback memoizes a function so it doesn't get recreated
   * on every render. This is important when the function is used as a
   * dependency in a useEffect — without it, the effect would run in an
   * infinite loop (function recreated → effect runs → state changes → render
   * → function recreated → ...).
   */
  const fetchCandles = useCallback(async (sessionId) => {
    try {
      const res = await client.get(`/Replay/${sessionId}/candles`);
      setCandles(res.data);
    } catch (err) {
      console.error("Failed to fetch candles:", err);
      setError("Could not load candles. Is the API running?");
    }
  }, []);

  const fetchTrades = useCallback(async (sessionId) => {
    try {
      const res = await client.get(`/Trade/history/${sessionId}`);
      setTrades(res.data);
    } catch (err) {
      console.error("Failed to fetch trades:", err);
    }
  }, []);

  // Check DB status on mount so user knows if data is seeded
  useEffect(() => {
    const checkDb = async () => {
      try {
        const res = await client.get("/Seed/status?symbol=EURUSD");
        setDbStatus(res.data);
      } catch {
        setDbStatus({ count: 0, message: "API unreachable" });
      }
    };
    checkDb();
  }, []);

  // ── Session Controls ────────────────────────────────────────────────────────

  const startSession = async () => {
    setLoading(true);
    setError(null);
    try {
      // We start at the earliest point of our seeded data
      const res = await client.post(
        "/Replay/start?symbol=EURUSD&startTime=2026-05-01T00:00:00Z"
      );
      setSession(res.data);
      await fetchCandles(res.data.id);
      await fetchTrades(res.data.id);
    } catch (err) {
      setError("Failed to start session. Make sure the API is running on port 5273.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stepForward = async (minutes) => {
    if (!session) return;
    try {
      const res = await client.post(`/Replay/${session.id}/step?minutes=${minutes}`);
      // Update the local session's currentReplayTimestamp with what the server returned
      setSession((prev) => ({ ...prev, currentReplayTimestamp: res.data.currentTime }));
      await fetchCandles(session.id);
      await fetchTrades(session.id);
    } catch (err) {
      console.error("Step failed:", err);
      setError("Step forward failed.");
    }
  };

  // ── Trade Execution ─────────────────────────────────────────────────────────

  /**
   * LEARNING: The TradeController expects query parameters:
   *   POST /api/Trade/open?sessionId=...&direction=Buy&sl=...&tp=...&lots=...
   *
   * The `direction` must match the C# enum name exactly: "Buy" or "Sell"
   * because ASP.NET Core's model binding parses enum by name.
   */
  const placeTrade = async (direction) => {
    if (!session) {
      setTradeMessage({ type: "error", text: "Start a session first." });
      return;
    }
    if (!sl || !tp) {
      setTradeMessage({ type: "error", text: "Enter both SL and TP prices." });
      return;
    }

    setTradeLoading(true);
    setTradeMessage(null);
    try {
      await client.post(
        `/Trade/open?sessionId=${session.id}&direction=${direction}&sl=${sl}&tp=${tp}&lots=${lots}`
      );
      setTradeMessage({ type: "success", text: `${direction} order placed at market!` });
      await fetchTrades(session.id);
    } catch (err) {
      const msg = err.response?.data || "Trade placement failed.";
      setTradeMessage({ type: "error", text: String(msg) });
    } finally {
      setTradeLoading(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const currentPrice = candles.length > 0
    ? Number(candles[candles.length - 1].close ?? candles[candles.length - 1].Close).toFixed(5)
    : "—";

  const openTradesCount = trades.filter(
    (t) => t.status === 0 || t.status === "Open"
  ).length;

  const totalPnL = trades
    .filter((t) => t.status !== 0 && t.status !== "Open")
    .reduce((sum, t) => sum + Number(t.pnl), 0);

  const formattedTime = session?.currentReplayTimestamp
    ? new Date(session.currentReplayTimestamp).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "UTC",
      }) + " UTC"
    : "Not started";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ── Top Header Bar ── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            Aegis<span className="text-blue-400">Trader</span>
          </h1>
          <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700">
            REPLAY ENGINE
          </span>
        </div>

        {/* DB Status Indicator */}
        {dbStatus && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${
            dbStatus.count > 0
              ? "text-green-400 border-green-800 bg-green-950/40"
              : "text-amber-400 border-amber-800 bg-amber-950/40"
          }`}>
            {dbStatus.count > 0 ? (
              <><CheckCircle size={11} /> {Number(dbStatus.count).toLocaleString()} candles seeded</>
            ) : (
              <><AlertCircle size={11} /> No data in DB</>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {session && (
            <Link
              to={`/analytics/${session.id}`}
              className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <BarChart2 size={14} /> Analytics
            </Link>
          )}
          <button
            onClick={startSession}
            disabled={loading || !!session}
            id="btn-start-session"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            {loading ? "Initializing..." : session ? "Session Active" : "Start Session"}
          </button>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-red-950/60 border border-red-800 text-red-400 px-4 py-3 text-sm">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-400">✕</button>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="px-6 pt-4 flex flex-wrap gap-3">
        <StatCard label="Symbol" value="EURUSD" icon={BarChart2} />
        <StatCard label="Current Price" value={currentPrice} color="text-blue-300" icon={Activity} />
        <StatCard label="Replay Time" value={formattedTime} icon={Clock} color="text-slate-300" />
        <StatCard
          label="Session P&L"
          value={`${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`}
          color={totalPnL >= 0 ? "text-green-400" : "text-red-400"}
          icon={Wallet}
        />
        <StatCard label="Open Trades" value={openTradesCount} color="text-blue-400" icon={Activity} />
      </div>

      {/* ── Main Content ── */}
      <main className="flex-1 flex gap-4 p-6 pt-4">

        {/* Left: Chart + Timeline Controls */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Timeline step controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 mr-1">STEP FORWARD:</span>
            {[
              { label: "+1m",  mins: 1   },
              { label: "+5m",  mins: 5   },
              { label: "+15m", mins: 15  },
              { label: "+1H",  mins: 60  },
              { label: "+4H",  mins: 240 },
            ].map(({ label, mins }) => (
              <button
                key={label}
                onClick={() => stepForward(mins)}
                disabled={!session}
                id={`btn-step-${label.replace("+", "")}`}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-mono font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FastForward size={11} />
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            {candles.length > 0 ? (
              <TradingChart data={candles} />
            ) : (
              <div className="h-[520px] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                  <BarChart2 size={28} className="text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-slate-400 font-medium">No chart data</p>
                  <p className="text-slate-600 text-sm mt-1">
                    {session ? "No candles at this timestamp." : "Press 'Start Session' to begin the replay."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Trade History Panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2">
                <BarChart2 size={14} />
                Trade History
                {trades.length > 0 && (
                  <span className="ml-1 text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full">
                    {trades.length}
                  </span>
                )}
              </span>
              <ChevronRight
                size={14}
                className={`text-slate-500 transition-transform ${showHistory ? "rotate-90" : ""}`}
              />
            </button>

            {showHistory && (
              <div className="overflow-x-auto border-t border-slate-800">
                {trades.length === 0 ? (
                  <p className="text-center text-slate-600 text-sm py-6">No trades placed yet.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider bg-slate-900/80">
                        <th className="py-2 px-3">Dir</th>
                        <th className="py-2 px-3">Entry</th>
                        <th className="py-2 px-3">SL</th>
                        <th className="py-2 px-3">TP</th>
                        <th className="py-2 px-3">P&L ($)</th>
                        <th className="py-2 px-3">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t) => (
                        <TradeRow key={t.id} trade={t} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Trade Execution Panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4">

          {/* Trade Form */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
              <Activity size={14} className="text-blue-400" />
              Market Execution
            </h2>

            {/* Current price display */}
            <div className="bg-slate-800/60 rounded-lg p-3 mb-4 text-center border border-slate-700">
              <p className="text-xs text-slate-500 mb-0.5">ASK / BID (Market)</p>
              <p className="font-mono text-lg font-bold text-blue-300">{currentPrice}</p>
              <p className="text-xs text-slate-600 mt-0.5">EURUSD · 1-Minute</p>
            </div>

            <div className="space-y-3">
              {/* Stop Loss */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                  <XCircle size={11} className="text-red-500" />
                  Stop Loss (SL)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  placeholder="e.g. 1.12800"
                  id="input-sl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-red-600/60 transition"
                />
              </div>

              {/* Take Profit */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-green-500" />
                  Take Profit (TP)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  placeholder="e.g. 1.13400"
                  id="input-tp"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-green-600/60 transition"
                />
              </div>

              {/* Lot Size */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">
                  Lot Size
                </label>
                <div className="flex gap-2">
                  {["0.01", "0.1", "1.0"].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLots(l)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition font-mono ${
                        lots === l
                          ? "bg-blue-600/30 border-blue-600 text-blue-300"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={lots}
                  onChange={(e) => setLots(e.target.value)}
                  id="input-lots"
                  className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-600/60 transition"
                />
              </div>

              {/* Trade message */}
              {tradeMessage && (
                <div
                  className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                    tradeMessage.type === "success"
                      ? "bg-green-950/60 text-green-400 border border-green-800"
                      : "bg-red-950/60 text-red-400 border border-red-800"
                  }`}
                >
                  {tradeMessage.type === "success" ? (
                    <CheckCircle size={12} />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  {tradeMessage.text}
                </div>
              )}

              {/* BUY / SELL buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => placeTrade("Buy")}
                  disabled={tradeLoading || !session}
                  id="btn-buy"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-green-600/15 py-4 font-bold text-green-500 border border-green-600/30 hover:bg-green-600/25 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <TrendingUp size={22} />
                  <span className="text-sm">BUY</span>
                  <span className="text-xs font-mono text-green-700">{currentPrice}</span>
                </button>
                <button
                  onClick={() => placeTrade("Sell")}
                  disabled={tradeLoading || !session}
                  id="btn-sell"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-red-600/15 py-4 font-bold text-red-500 border border-red-600/30 hover:bg-red-600/25 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <TrendingDown size={22} />
                  <span className="text-sm">SELL</span>
                  <span className="text-xs font-mono text-red-700">{currentPrice}</span>
                </button>
              </div>
            </div>
          </div>

          {/* How It Works Card */}
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Overlap Constraint
            </h3>
            <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
              <p>If a single candle hits both your <span className="text-red-400">SL</span> and <span className="text-green-400">TP</span> simultaneously, the engine defaults to a <span className="text-red-400 font-semibold">Stop Loss</span> closure.</p>
              <p>This mirrors real-world adverse slippage — the pessimistic assumption guarantees realistic backtesting results.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReplayPage;
