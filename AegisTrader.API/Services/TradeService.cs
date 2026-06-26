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

    // 1. Place a new trade
    public async Task<Trade> PlaceTrade(Guid sessionId, TradeDirection direction, decimal entry, decimal sl, decimal tp, decimal lotSize, DateTime currentTime)
    {
        var trade = new Trade
        {
            SessionId = sessionId,
            Direction = direction,
            EntryPrice = entry,
            StopLoss = sl,
            TakeProfit = tp,
            LotSize = lotSize,
            OpenedAt = currentTime,
            Status = TradeStatus.Open
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

        foreach (var trade in openTrades)
        {
            bool hitSl = false;
            bool hitTp = false;

            if (trade.Direction == TradeDirection.Buy)
            {
                if (candle.Low <= trade.StopLoss) hitSl = true;
                if (candle.High >= trade.TakeProfit) hitTp = true;
            }
            else // Sell
            {
                if (candle.High >= trade.StopLoss) hitSl = true;
                if (candle.Low <= trade.TakeProfit) hitTp = true;
            }

            // --- THE OVERLAP CONSTRAINT LOGIC ---
            if (hitSl && hitTp)
            {
                // Pessimistic assumption: If both hit in 1 minute, assume Stop Loss first
                CloseTrade(trade, trade.StopLoss, candle.Timestamp);
            }
            else if (hitSl)
            {
                CloseTrade(trade, trade.StopLoss, candle.Timestamp);
            }
            else if (hitTp)
            {
                CloseTrade(trade, trade.TakeProfit, candle.Timestamp);
            }
        }

        await _context.SaveChangesAsync();
    }

    private void CloseTrade(Trade trade, decimal exitPrice, DateTime closeTime)
    {
        trade.Status = TradeStatus.Closed;
        trade.ExitPrice = exitPrice;
        trade.ClosedAt = closeTime;

        // Simplified Pip calculation for EURUSD (1 pip = 0.0001)
        decimal pipValue = 10; // Standard lot pip value approx $10
        decimal pips = 0;

        if (trade.Direction == TradeDirection.Buy)
            pips = (exitPrice - trade.EntryPrice) * 10000;
        else
            pips = (trade.EntryPrice - exitPrice) * 10000;

        trade.PnL = pips * trade.LotSize * pipValue;
    }
}