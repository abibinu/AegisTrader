using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

public class ReplayService
{
    private readonly AegisDbContext _context;
    private readonly TradeService _tradeService;

    public ReplayService(AegisDbContext context, TradeService tradeService)
    {
        _context = context;
        _tradeService = tradeService;
    }

    // 1. Start a new session
    public async Task<TradingSession> CreateSession(Guid userId, string symbol, DateTime startTime)
    {
        var session = new TradingSession
        {
            UserId = userId,
            Symbol = symbol,
            CurrentReplayTimestamp = startTime,
            InitialBalance = 10000,
            CurrentBalance = 10000
        };

        _context.TradingSessions.Add(session);
        await _context.SaveChangesAsync();
        return session;
    }

    // 2. The "Time Machine" Logic: Get visible candles
    public async Task<List<Candlestick>> GetVisibleCandles(Guid sessionId)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        // 1. Get the latest 200 candles by sorting DESCENDING
        var candles = await _context.Candlesticks
            .Where(c => c.Symbol == session.Symbol && c.Timestamp <= session.CurrentReplayTimestamp)
            .OrderByDescending(c => c.Timestamp) // Newest first
            .Take(200)                          // Databases understand .Take()
            .ToListAsync();

        // 2. Reverse them in C# memory so the chart shows them from Oldest -> Newest
        return candles.OrderBy(c => c.Timestamp).ToList();
    }

    // 3. Step forward in time
    public async Task<DateTime> StepForward(Guid sessionId, int minutesToStep)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        // Advance the clock 1 minute at a time to check for hits inside the gap
        for (int i = 0; i < minutesToStep; i++)
        {
            session.CurrentReplayTimestamp = session.CurrentReplayTimestamp.AddMinutes(1);

            // Find the candle for this specific minute
            var candle = await _context.Candlesticks
                .FirstOrDefaultAsync(c => c.Symbol == session.Symbol && c.Timestamp == session.CurrentReplayTimestamp);

            if (candle != null)
            {
                // CHECK FOR TRADES
                await _tradeService.EvaluateOpenTrades(sessionId, candle);
            }
        }

        await _context.SaveChangesAsync();
        return session.CurrentReplayTimestamp;
    }
}