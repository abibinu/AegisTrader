using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

public class TradeService
{
    private readonly AegisDbContext _context;

    public TradeService(AegisDbContext context)
    {
        _context = context;
    }

    // 1. Place a new trade at the current replay price
    public async Task<Trade> PlaceTrade(
        Guid sessionId, TradeDirection direction, decimal entry,
        decimal sl, decimal tp, decimal lotSize, DateTime currentTime)
    {
        var trade = new Trade
        {
            SessionId  = sessionId,
            Direction  = direction,
            EntryPrice = entry,
            StopLoss   = sl,
            TakeProfit = tp,
            LotSize    = lotSize,
            OpenedAt   = currentTime,
            Status     = TradeStatus.Open
        };

        _context.Trades.Add(trade);
        await _context.SaveChangesAsync();
        return trade;
    }

    // 2. The Overlap Constraint: Evaluate open trades against a new candle
    public async Task EvaluateOpenTrades(Guid sessionId, Candlestick candle)
    {
        var openTrades = await _context.Trades
            .Where(t => t.SessionId == sessionId && t.Status == TradeStatus.Open)
            .ToListAsync();

        // Load the session ONCE so we can update CurrentBalance when trades close.
        // FIX: Previously, balance was never updated — analytics always showed $10,000.
        var session = await _context.TradingSessions.FindAsync(sessionId);

        foreach (var trade in openTrades)
        {
            bool hitSl = false;
            bool hitTp = false;

            if (trade.Direction == TradeDirection.Buy)
            {
                if (candle.Low  <= trade.StopLoss)   hitSl = true;
                if (candle.High >= trade.TakeProfit)  hitTp = true;
            }
            else // Sell
            {
                if (candle.High >= trade.StopLoss)    hitSl = true;
                if (candle.Low  <= trade.TakeProfit)  hitTp = true;
            }

            // THE OVERLAP CONSTRAINT: If both hit on the same 1m candle,
            // pessimistically assume the Stop Loss filled first (adverse slippage).
            if (hitSl && hitTp)
                CloseTrade(trade, trade.StopLoss, candle.Timestamp, session);
            else if (hitSl)
                CloseTrade(trade, trade.StopLoss, candle.Timestamp, session);
            else if (hitTp)
                CloseTrade(trade, trade.TakeProfit, candle.Timestamp, session);
        }

        await _context.SaveChangesAsync();
    }

    // ── Core close logic — computes Pip P&L and updates account balance ────────
    private void CloseTrade(Trade trade, decimal exitPrice, DateTime closeTime, TradingSession? session)
    {
        trade.Status    = TradeStatus.Closed;
        trade.ExitPrice = exitPrice;
        trade.ClosedAt  = closeTime;

        // Forex pip calculation:
        // 1 standard lot EURUSD = $10 per pip
        // 1 pip = 0.0001 (4th decimal place)
        // Pips moved = price difference × 10,000
        decimal pipValue = 10m; // per standard lot, per pip
        decimal pips;

        if (trade.Direction == TradeDirection.Buy)
            pips = (exitPrice - trade.EntryPrice) * 10000m;
        else
            pips = (trade.EntryPrice - exitPrice) * 10000m;

        trade.PnL = pips * trade.LotSize * pipValue;

        // FIX: Persist the balance change to the session so analytics are accurate.
        // Previously this was never done — session.CurrentBalance stayed at 10,000 forever.
        if (session != null)
            session.CurrentBalance += trade.PnL;
    }
}