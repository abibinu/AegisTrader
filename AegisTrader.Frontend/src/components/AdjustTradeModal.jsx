import { useState, useEffect } from 'react';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle,
  X,
  AlertCircle,
  Save,
  ArrowUp,
  ArrowDown,
  Lock
} from 'lucide-react';

/**
 * AdjustTradeModal — Modify Stop Loss and Take Profit of active open trades.
 * Supports:
 *  - Real-time price nudging (+/- 1 pip, +/- 5 pips)
 *  - Move to Break-Even (sets SL = Entry Price)
 *  - Pick directly on chart (click-to-set)
 *  - Instant synchronization with backend (Replay) and state (Live)
 */
export default function AdjustTradeModal({
  isOpen,
  trade,
  currentPrice,
  symbol = 'EURUSD',
  onSave,
  onClose,
  onPickOnChart,
}) {
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const getPipStep = (sym) => {
    const s = sym?.toUpperCase() ?? '';
    if (s.includes('JPY')) return 0.01;
    if (s === 'XAUUSD' || s === 'GOLD') return 0.50;
    if (s === 'BTCUSD' || s === 'BITCOIN') return 50.0;
    return 0.0001; // 5-decimal Forex
  };

  const getDecimals = (sym) => {
    const s = sym?.toUpperCase() ?? '';
    if (s.includes('JPY')) return 3;
    if (s === 'XAUUSD' || s === 'BTCUSD' || s === 'GOLD') return 2;
    return 5;
  };

  const pipStep = getPipStep(symbol);
  const decimals = getDecimals(symbol);

  useEffect(() => {
    if (trade && isOpen) {
      const initialSl = trade.stopLoss ?? trade.StopLoss ?? trade.sl;
      const initialTp = trade.takeProfit ?? trade.TakeProfit ?? trade.tp;
      setSl(initialSl ? Number(initialSl).toFixed(decimals) : '');
      setTp(initialTp ? Number(initialTp).toFixed(decimals) : '');
      setError(null);
    }
  }, [trade, isOpen, decimals]);

  if (!isOpen || !trade) return null;

  const isBuy = trade.direction === 0 || trade.direction === 'Buy';
  const entryPrice = Number(trade.entryPrice ?? trade.EntryPrice ?? trade.entry ?? 0);
  const curPriceNum = Number(currentPrice);

  const handleNudgeSl = (pips) => {
    const currentSl = sl ? Number(sl) : (isBuy ? entryPrice - pipStep * 10 : entryPrice + pipStep * 10);
    const updated = currentSl + (pips * pipStep);
    setSl(updated.toFixed(decimals));
  };

  const handleNudgeTp = (pips) => {
    const currentTp = tp ? Number(tp) : (isBuy ? entryPrice + pipStep * 20 : entryPrice - pipStep * 20);
    const updated = currentTp + (pips * pipStep);
    setTp(updated.toFixed(decimals));
  };

  const handleMoveToBreakEven = () => {
    if (entryPrice > 0) {
      // Set SL to exact entry price (zero risk)
      setSl(entryPrice.toFixed(decimals));
    }
  };

  const handleSave = async () => {
    setError(null);
    const slNum = sl ? Number(sl) : null;
    const tpNum = tp ? Number(tp) : null;

    if (slNum === null || tpNum === null || isNaN(slNum) || isNaN(tpNum)) {
      setError('Please provide valid numbers for both Stop Loss and Take Profit.');
      return;
    }

    // Directional validation
    if (isBuy) {
      if (slNum >= entryPrice && !slNum) {
        setError('Stop Loss should be below entry for BUY (unless locked at break-even).');
      }
      if (tpNum <= entryPrice) {
        setError('Take Profit must be above entry price for BUY.');
        return;
      }
    } else {
      if (tpNum >= entryPrice) {
        setError('Take Profit must be below entry price for SELL.');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(trade.id ?? trade.Id, slNum, tpNum);
      onClose();
    } catch (err) {
      console.error('Failed to update SL/TP:', err);
      setError('Failed to update trade parameters on the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden my-auto animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isBuy ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400' : 'bg-rose-950/80 border-rose-500/40 text-rose-400'
            }`}>
              {isBuy ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Adjust SL / TP Targets
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {isBuy ? 'BUY' : 'SELL'} #{String(trade.id ?? trade.Id).slice(0, 6)}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Entry: {entryPrice.toFixed(decimals)} · Current: {curPriceNum > 0 ? curPriceNum.toFixed(decimals) : '—'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-950/60 border border-red-800 rounded-lg text-red-300">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Break-Even Fast Action */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">Risk-Free Protection</p>
                <p className="text-[11px] text-slate-500">Snap Stop Loss to exact entry price</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleMoveToBreakEven}
              id="btn-move-to-breakeven"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 text-xs font-semibold font-mono transition cursor-pointer"
            >
              <Lock size={12} />
              Move to Break-Even ({entryPrice.toFixed(decimals)})
            </button>
          </div>

          {/* Stop Loss (SL) Adjustment */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                Stop Loss (SL)
              </label>
              {onPickOnChart && (
                <button
                  type="button"
                  onClick={() => {
                    onPickOnChart('sl', trade);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                >
                  <Target size={12} />
                  Pick on Chart
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                id="input-adjust-sl"
                className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-rose-500"
                placeholder={`e.g. ${entryPrice > 0 ? (isBuy ? (entryPrice - pipStep * 15).toFixed(decimals) : (entryPrice + pipStep * 15).toFixed(decimals)) : '0.00000'}`}
              />

              {/* Nudge Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNudgeSl(-1)}
                  className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
                  title="Subtract 1 pip"
                >
                  -1p
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSl(1)}
                  className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
                  title="Add 1 pip"
                >
                  +1p
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSl(5)}
                  className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
                  title="Add 5 pips"
                >
                  +5p
                </button>
              </div>
            </div>
          </div>

          {/* Take Profit (TP) Adjustment */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                Take Profit (TP)
              </label>
              {onPickOnChart && (
                <button
                  type="button"
                  onClick={() => {
                    onPickOnChart('tp', trade);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                >
                  <Target size={12} />
                  Pick on Chart
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                id="input-adjust-tp"
                className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder={`e.g. ${entryPrice > 0 ? (isBuy ? (entryPrice + pipStep * 30).toFixed(decimals) : (entryPrice - pipStep * 30).toFixed(decimals)) : '0.00000'}`}
              />

              {/* Nudge Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNudgeTp(-1)}
                  className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
                  title="Subtract 1 pip"
                >
                  -1p
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeTp(1)}
                  className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
                  title="Add 1 pip"
                >
                  +1p
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeTp(5)}
                  className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
                  title="Add 5 pips"
                >
                  +5p
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            id="btn-save-sl-tp"
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            {saving ? 'Updating...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
