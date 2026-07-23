import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import TradingChart from '../components/TradingChart';
import {
  Activity,
  BarChart2,
  Clock,
  Wallet,
  Play,
  LogOut,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const LivePage = () => {
  const { user, logout } = useAuth();

  // User-scoped storage keys so each user gets their own session history
  const userId = user?.userId ?? user?.username ?? 'guest';
  const STORAGE_BALANCE    = `live_balance_${userId}`;
  const STORAGE_OPEN       = `live_open_trades_${userId}`;
  const STORAGE_HISTORY    = `live_trade_history_${userId}`;

  // ── States ──────────────────────────────────────────────────────────────────
  const [currentTick, setCurrentTick] = useState({
    symbol: "EURUSD",
    bid: 1.08500,
    ask: 1.08512,
    timestamp: new Date().toISOString()
  });
  
  const [prevTick, setPrevTick] = useState(null);
  const [candles, setCandles] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [error, setError] = useState(null);

  // Client-side Paper Session Balance (user-scoped)
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem(STORAGE_BALANCE);
    return saved ? Number(saved) : 10000;
  });

  // Active trades and history (user-scoped)
  const [openTrades, setOpenTrades] = useState(() => {
    const saved = localStorage.getItem(STORAGE_OPEN);
    return saved ? JSON.parse(saved) : [];
  });

  const [tradeHistory, setTradeHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_HISTORY);
    return saved ? JSON.parse(saved) : [];
  });

  // Input states
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [lots, setLots] = useState("0.1");
  const [tradeMessage, setTradeMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(true);

  // Persist state in user-scoped localStorage keys
  useEffect(() => {
    localStorage.setItem(STORAGE_BALANCE, balance.toString());
  }, [balance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_OPEN, JSON.stringify(openTrades));
  }, [openTrades]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(tradeHistory));
  }, [tradeHistory]);

  // Sync ref so tick useEffect can read current open trades without stale closures
  const openTradesRef = useRef(openTrades);
  useEffect(() => {
    openTradesRef.current = openTrades;
  }, [openTrades]);

  // Guard set: track trade IDs currently being closed to prevent duplicate closes
  // This is critical to prevent React StrictMode double-invocation of effects
  const processingTradeIds = useRef(new Set());

  // Check DB status on mount
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

  // Fetch initial candles baseline — request 500 candles (~8 hours of 1-min data)
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await client.get("/LivePrice/history?symbol=EURUSD&count=500");
        const history = res.data;
        if (history && history.length > 0) {
          // Calculate timestamp offset to align the latest historical candle with the current time
          const latestCandleTime = new Date(history[history.length - 1].timestamp ?? history[history.length - 1].Timestamp).getTime();
          const currentTime = Date.now();
          const offsetMs = currentTime - latestCandleTime;

          // Shift all historical candles forward by this offset
          const shiftedHistory = history.map(c => {
            const originalTime = new Date(c.timestamp ?? c.Timestamp).getTime();
            const newTime = new Date(originalTime + offsetMs).toISOString();
            return {
              ...c,
              timestamp: newTime,
              Timestamp: newTime
            };
          });
          setCandles(shiftedHistory);
        }
      } catch (err) {
        console.error("Failed to load historical candles:", err);
      }
    };
    fetchHistory();
  }, []);

  // ── Tick Polling & Chart Rolling Engine ─────────────────────────────────────
  useEffect(() => {
    const pollTick = async () => {
      try {
        const res = await client.get("/LivePrice/latest?symbol=EURUSD");
        const tick = res.data;
        
        setCurrentTick(prev => {
          setPrevTick(prev);
          return {
            symbol: tick.symbol ?? tick.Symbol,
            bid: Number(tick.bid ?? tick.Bid),
            ask: Number(tick.ask ?? tick.Ask),
            timestamp: tick.timestamp ?? tick.Timestamp
          };
        });
      } catch (err) {
        console.error("Failed to poll tick:", err);
      }
    };

    // Poll every 500ms
    const interval = setInterval(pollTick, 500);
    return () => clearInterval(interval);
  }, []);

  // Roll ticks into candles and check trade triggers
  useEffect(() => {
    if (!currentTick) return;

    // 1. Roll ticks into chart candles
    setCandles(prevCandles => {
      if (prevCandles.length === 0) return [];
      
      const newCandles = [...prevCandles];
      const lastCandle = { ...newCandles[newCandles.length - 1] };
      
      const lastTime = new Date(lastCandle.timestamp ?? lastCandle.Timestamp);
      const tickTime = new Date(currentTick.timestamp);
      
      // Compare minute boundaries
      const isSameMinute = 
        lastTime.getUTCFullYear() === tickTime.getUTCFullYear() &&
        lastTime.getUTCMonth() === tickTime.getUTCMonth() &&
        lastTime.getUTCDate() === tickTime.getUTCDate() &&
        lastTime.getUTCHours() === tickTime.getUTCHours() &&
        lastTime.getUTCMinutes() === tickTime.getUTCMinutes();

      const price = currentTick.bid; // use bid as close reference

      if (isSameMinute) {
        // Update current candle
        lastCandle.Close = price;
        lastCandle.close = price;
        if (price > lastCandle.High) {
          lastCandle.High = price;
          lastCandle.high = price;
        }
        if (price < lastCandle.Low) {
          lastCandle.Low = price;
          lastCandle.low = price;
        }
        newCandles[newCandles.length - 1] = lastCandle;
      } else {
        // Create new candle object
        const newCandle = {
          Timestamp: currentTick.timestamp,
          timestamp: currentTick.timestamp,
          Open: price, open: price,
          High: price, high: price,
          Low: price, low: price,
          Close: price, close: price,
          Volume: 0, volume: 0
        };
        newCandles.push(newCandle);
        // Keep chart clean — trim oldest candles beyond 600 to maintain performance
        if (newCandles.length > 600) {
          newCandles.shift();
        }
      }
      return newCandles;
    });

    // 2. Evaluate active open orders against current tick prices
    // Use processingTradeIds guard to ensure each trade is only closed ONCE,
    // even if React StrictMode fires this effect twice with the same tick.
    const currentActiveTrades = openTradesRef.current;
    if (currentActiveTrades.length > 0) {
      const closedNow = [];

      currentActiveTrades.forEach(t => {
        // Skip if this trade is already being processed by a previous effect invocation
        if (processingTradeIds.current.has(t.id)) return;

        const bid = currentTick.bid;
        const ask = currentTick.ask;
        const slPrice = t.sl ? Number(t.sl) : null;
        const tpPrice = t.tp ? Number(t.tp) : null;
        let hitSl = false;
        let hitTp = false;
        let exitPrice = 0;

        if (t.direction === "Buy") {
          if (slPrice && bid <= slPrice) { hitSl = true; exitPrice = slPrice; }
          else if (tpPrice && bid >= tpPrice) { hitTp = true; exitPrice = tpPrice; }
        } else {
          if (slPrice && ask >= slPrice) { hitSl = true; exitPrice = slPrice; }
          else if (tpPrice && ask <= tpPrice) { hitTp = true; exitPrice = tpPrice; }
        }

        if (hitSl || hitTp) {
          // Mark as processing immediately to block duplicate closes
          processingTradeIds.current.add(t.id);
          const pnl = calculatePnL(t.direction, Number(t.entry), exitPrice, Number(t.lots));
          closedNow.push({
            ...t,
            exit: exitPrice,
            pnl,
            status: "Closed",
            closedAt: new Date().toISOString(),
            result: pnl > 0 ? "Win" : "Loss"
          });
        }
      });

      if (closedNow.length > 0) {
        const closedIds = new Set(closedNow.map(t => t.id));
        setOpenTrades(prev => prev.filter(t => !closedIds.has(t.id)));
        setBalance(b => b + closedNow.reduce((sum, t) => sum + t.pnl, 0));
        // Deduplicate before adding: ensure no trade id already in history
        setTradeHistory(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newClosed = closedNow.filter(t => !existingIds.has(t.id));
          return newClosed.length > 0 ? [...newClosed, ...prev] : prev;
        });
        // Remove from processing guard after state updates are queued
        setTimeout(() => {
          closedNow.forEach(t => processingTradeIds.current.delete(t.id));
        }, 2000);
      }
    }

  }, [currentTick]);

  // Calculate Pip value P&L (1 standard lot EURUSD = $10 per pip)
  const calculatePnL = (direction, entry, exit, lotSize) => {
    const pipValue = 10;
    let pips = 0;
    if (direction === "Buy") {
      pips = (exit - entry) * 10000;
    } else {
      pips = (entry - exit) * 10000;
    }
    return pips * lotSize * pipValue;
  };

  // ── Trade Placement ─────────────────────────────────────────────────────────
  const placeTrade = (direction) => {
    setTradeMessage(null);
    const entryPrice = direction === "Buy" ? currentTick.ask : currentTick.bid;
    const lotSize = Number(lots);

    if (isNaN(lotSize) || lotSize <= 0) {
      setTradeMessage({ type: "error", text: "Invalid lot size." });
      return;
    }

    const slVal = sl ? Number(sl) : null;
    const tpVal = tp ? Number(tp) : null;

    // Validation checks
    if (direction === "Buy") {
      if (slVal && slVal >= entryPrice) {
        setTradeMessage({ type: "error", text: "SL must be below entry price for BUY." });
        return;
      }
      if (tpVal && tpVal <= entryPrice) {
        setTradeMessage({ type: "error", text: "TP must be above entry price for BUY." });
        return;
      }
    } else {
      if (slVal && slVal <= entryPrice) {
        setTradeMessage({ type: "error", text: "SL must be above entry price for SELL." });
        return;
      }
      if (tpVal && tpVal >= entryPrice) {
        setTradeMessage({ type: "error", text: "TP must be below entry price for SELL." });
        return;
      }
    }

    const newTrade = {
      id: crypto.randomUUID(),
      direction,
      entry: entryPrice,
      lots: lotSize,
      sl: slVal,
      tp: tpVal,
      status: "Open",
      openedAt: new Date().toISOString()
    };

    setOpenTrades(prev => [newTrade, ...prev]);
    setTradeMessage({ type: "success", text: `${direction} order filled at ${entryPrice.toFixed(5)}!` });
    setSl("");
    setTp("");
  };

  const closeTradeManually = (id) => {
    // Guard: prevent closing a trade that's already being closed
    if (processingTradeIds.current.has(id)) return;
    const tradeToClose = openTrades.find(t => t.id === id);
    if (!tradeToClose) return;

    processingTradeIds.current.add(id);
    const exitPrice = tradeToClose.direction === "Buy" ? currentTick.bid : currentTick.ask;
    const pnl = calculatePnL(tradeToClose.direction, Number(tradeToClose.entry), exitPrice, Number(tradeToClose.lots));
    
    const closedTrade = {
      ...tradeToClose,
      exit: exitPrice,
      pnl,
      status: "Closed",
      closedAt: new Date().toISOString(),
      result: pnl > 0 ? "Win" : "Loss"
    };

    setOpenTrades(prev => prev.filter(t => t.id !== id));
    setBalance(b => b + pnl);
    setTradeHistory(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      return existingIds.has(id) ? prev : [closedTrade, ...prev];
    });
    // Clean up processing guard
    setTimeout(() => processingTradeIds.current.delete(id), 2000);
  };

  const resetSession = () => {
    if (window.confirm("Are you sure you want to reset your live paper balance to $10,000 and clear history?")) {
      setBalance(10000);
      setOpenTrades([]);
      setTradeHistory([]);
      setTradeMessage(null);
      processingTradeIds.current.clear();
      localStorage.removeItem(STORAGE_BALANCE);
      localStorage.removeItem(STORAGE_OPEN);
      localStorage.removeItem(STORAGE_HISTORY);
    }
  };

  // ── Derived Values ──────────────────────────────────────────────────────────
  
  // Calculate dynamic floating open P&L
  const floatingPnL = openTrades.reduce((sum, t) => {
    const currentPrice = t.direction === "Buy" ? currentTick.bid : currentTick.ask;
    return sum + calculatePnL(t.direction, Number(t.entry), currentPrice, Number(t.lots));
  }, 0);

  const realizedPnL = tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  const runningEquity = balance + floatingPnL;
  const totalPnL = realizedPnL + floatingPnL;

  // Flash color helper for tick updates
  const tickColor = prevTick
    ? currentTick.bid > prevTick.bid
      ? "text-emerald-400"
      : currentTick.bid < prevTick.bid
      ? "text-rose-500"
      : "text-blue-300"
    : "text-blue-300";

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ── Top Header Bar ── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            Aegis<span className="text-blue-400">Trader</span>
          </h1>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
            <Link to="/replay" className="text-slate-400 hover:text-white font-semibold px-2.5 py-1 rounded-md transition">
              Replay Engine
            </Link>
            <span className="bg-slate-800 text-white font-semibold px-2.5 py-1 rounded-md cursor-default">
              Live Sandbox
            </span>
          </div>
        </div>

        {/* Live Feed Status Indicator */}
        <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-emerald-800 bg-emerald-950/40 text-emerald-400 animate-pulse">
          <Activity size={11} /> Live Feed Active (500ms Ticks)
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{user.username}</span>
            </div>
          )}

          <button
            onClick={resetSession}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            Reset Arena
          </button>

          <button
            onClick={logout}
            id="btn-logout"
            title="Logout"
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:border-red-900 transition"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Stats Bar ── */}
      <div className="px-6 pt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
          <Activity size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Symbol</p>
            <p className="text-sm font-bold font-mono text-white">EURUSD</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
          <Activity size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Current Bid</p>
            <p className={`text-sm font-bold font-mono transition-colors duration-200 ${tickColor}`}>
              {currentTick.bid.toFixed(5)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
          <Wallet size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Account Balance</p>
            <p className="text-sm font-bold font-mono text-slate-300">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
          <Wallet size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Live Equity</p>
            <p className="text-sm font-bold font-mono text-emerald-400">
              ${runningEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
          <Wallet size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Session P&L</p>
            <p className={`text-sm font-bold font-mono ${totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
            </p>
            {openTrades.length > 0 && (
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                Realized: ${realizedPnL.toFixed(2)} | Open: ${floatingPnL >= 0 ? "+" : ""}${floatingPnL.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
          <Activity size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Open Positions</p>
            <p className="text-sm font-bold font-mono text-blue-400">{openTrades.length}</p>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <main className="flex-1 flex gap-4 p-6 pt-4">

        {/* Left pane: upgraded TradingView-style chart + trade ledger */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            {candles.length > 0 ? (
              <TradingChart data={candles} trades={openTrades.concat(tradeHistory)} />
            ) : (
              <div className="h-[520px] flex flex-col items-center justify-center gap-4">
                <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
                <p className="text-slate-400 font-medium">Loading live candles baseline context...</p>
              </div>
            )}
          </div>

          {/* Active Positions & Trade History Panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="flex border-b border-slate-800 bg-slate-900/60 text-sm">
              <button
                onClick={() => setShowHistory(false)}
                className={`px-4 py-3 font-semibold transition ${
                  !showHistory ? "border-b-2 border-blue-500 text-white bg-slate-800/30" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Active Positions ({openTrades.length})
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className={`px-4 py-3 font-semibold transition ${
                  showHistory ? "border-b-2 border-blue-500 text-white bg-slate-800/30" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Trade History ({tradeHistory.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              {!showHistory ? (
                // Active positions table
                openTrades.length === 0 ? (
                  <p className="text-center text-slate-600 text-sm py-8">No open positions. Use the right panel to execute orders.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider bg-slate-900/80 border-b border-slate-800">
                        <th className="py-2.5 px-3">Dir</th>
                        <th className="py-2.5 px-3">Lots</th>
                        <th className="py-2.5 px-3">Entry</th>
                        <th className="py-2.5 px-3">SL</th>
                        <th className="py-2.5 px-3">TP</th>
                        <th className="py-2.5 px-3">Live Price</th>
                        <th className="py-2.5 px-3">Floating P&L ($)</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openTrades.map((t) => {
                        const curPrice = t.direction === "Buy" ? currentTick.bid : currentTick.ask;
                        const pnl = calculatePnL(t.direction, Number(t.entry), curPrice, Number(t.lots));
                        return (
                          <tr key={t.id} className="border-b border-slate-800/40 hover:bg-slate-800/35 transition font-mono text-xs">
                            <td className="py-2 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full font-bold ${
                                t.direction === "Buy" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {t.direction === "Buy" ? "▲ BUY" : "▼ SELL"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{t.lots.toFixed(2)}</td>
                            <td className="py-2 px-3 text-slate-300">{t.entry.toFixed(5)}</td>
                            <td className="py-2 px-3 text-slate-500">{t.sl ? t.sl.toFixed(5) : "—"}</td>
                            <td className="py-2 px-3 text-slate-500">{t.tp ? t.tp.toFixed(5) : "—"}</td>
                            <td className="py-2 px-3 text-slate-300">{curPrice.toFixed(5)}</td>
                            <td className={`py-2 px-3 font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => closeTradeManually(t.id)}
                                className="bg-slate-800 border border-slate-700 hover:bg-red-650 hover:border-red-900 text-[10px] font-semibold text-slate-300 hover:text-white px-2 py-1 rounded transition"
                              >
                                CLOSE
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                // Closed trade history table
                tradeHistory.length === 0 ? (
                  <p className="text-center text-slate-600 text-sm py-8">No trades executed in this session yet.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider bg-slate-900/80 border-b border-slate-800">
                        <th className="py-2.5 px-3">Dir</th>
                        <th className="py-2.5 px-3">Lots</th>
                        <th className="py-2.5 px-3">Entry</th>
                        <th className="py-2.5 px-3">Exit</th>
                        <th className="py-2.5 px-3">SL</th>
                        <th className="py-2.5 px-3">TP</th>
                        <th className="py-2.5 px-3">P&L ($)</th>
                        <th className="py-2.5 px-3">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHistory.map((t) => (
                        <tr key={t.id} className="border-b border-slate-800/40 hover:bg-slate-800/35 transition font-mono text-xs">
                          <td className="py-2 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full font-bold ${
                              t.direction === "Buy" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {t.direction === "Buy" ? "▲ BUY" : "▼ SELL"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400">{t.lots.toFixed(2)}</td>
                          <td className="py-2 px-3 text-slate-400">{t.entry.toFixed(5)}</td>
                          <td className="py-2 px-3 text-slate-300">{t.exit.toFixed(5)}</td>
                          <td className="py-2 px-3 text-slate-500">{t.sl ? t.sl.toFixed(5) : "—"}</td>
                          <td className="py-2 px-3 text-slate-500">{t.tp ? t.tp.toFixed(5) : "—"}</td>
                          <td className={`py-2 px-3 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                            {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`flex items-center gap-1 font-bold ${t.result === "Win" ? "text-emerald-400" : "text-rose-500"}`}>
                              {t.result === "Win" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                              {t.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right pane: dynamic price and order placement form */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4">

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
              <Activity size={14} className="text-emerald-400" />
              Live Order Ticket
            </h2>

            {/* BID and ASK boxes */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">BID (Sell Price)</p>
                <p className="font-mono text-sm font-bold text-rose-400">{currentTick.bid.toFixed(5)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">ASK (Buy Price)</p>
                <p className="font-mono text-sm font-bold text-emerald-400">{currentTick.ask.toFixed(5)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Stop Loss input */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                  <XCircle size={11} className="text-rose-500" />
                  Stop Loss (SL)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  placeholder="e.g. 1.08200"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-650 focus:outline-none focus:border-rose-600/60 transition"
                />
              </div>

              {/* Take Profit input */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-emerald-500" />
                  Take Profit (TP)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  placeholder="e.g. 1.09200"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-650 focus:outline-none focus:border-emerald-600/60 transition"
                />
              </div>

              {/* Lot size selector */}
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
                          ? "bg-emerald-600/20 border-emerald-600 text-emerald-400"
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
                  className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-600/60 transition"
                />
              </div>

              {tradeMessage && (
                <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                  tradeMessage.type === "success"
                    ? "bg-green-950/60 text-green-400 border border-green-800"
                    : "bg-red-950/60 text-red-400 border border-red-800"
                }`}>
                  {tradeMessage.type === "success" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {tradeMessage.text}
                </div>
              )}

              {/* BUY / SELL executions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => placeTrade("Buy")}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-green-600/15 py-4 font-bold text-green-500 border border-green-600/30 hover:bg-green-600/25 transition"
                >
                  <TrendingUp size={22} />
                  <span className="text-sm">BUY</span>
                  <span className="text-xs font-mono text-green-700">{currentTick.ask.toFixed(5)}</span>
                </button>
                <button
                  onClick={() => placeTrade("Sell")}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-red-600/15 py-4 font-bold text-red-500 border border-red-600/30 hover:bg-red-600/25 transition"
                >
                  <TrendingDown size={22} />
                  <span className="text-sm">SELL</span>
                  <span className="text-xs font-mono text-red-700">{currentTick.bid.toFixed(5)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick info panel */}
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              MT5 Vantage Feed
            </h3>
            <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
              <p>Ticks are pushed dynamically from your Vantage demo account via local Python script bridge.</p>
              <p>If MT5 client connection is absent, the bridge automatically spins up a high-precision random walk generator simulating real market micro-ticks.</p>
            </div>
          </div>
        </div>

      </main>

    </div>
  );
};

export default LivePage;
