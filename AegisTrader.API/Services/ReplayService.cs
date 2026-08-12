using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

// DTO returned by StepForward so the frontend gets both time AND balance in one call.
public record StepResult(DateTime CurrentTime, decimal CurrentBalance);

public class ReplayService
{
    private readonly AegisDbContext _context;
    private readonly TradeService _tradeService;
    private readonly AggregationService _aggregation;

    public ReplayService(AegisDbContext context, TradeService tradeService, AggregationService aggregation)
    {
        _context      = context;
        _tradeService = tradeService;
        _aggregation  = aggregation;
    }

    // 1. Start a new session
    public async Task<TradingSession> CreateSession(Guid userId, string symbol, DateTime startTime)
    {
        var session = new TradingSession
        {
            UserId                 = userId,
            Symbol                 = symbol,
            CurrentReplayTimestamp = startTime,
            InitialBalance         = 10_000m,
            CurrentBalance         = 10_000m
        };
        _context.TradingSessions.Add(session);
        await _context.SaveChangesAsync();
        return session;
    }

    // 1b. Fetch an existing session by ID (used for frontend session restoration)
    public async Task<TradingSession?> GetSession(Guid sessionId)
    {
        return await _context.TradingSessions.FindAsync(sessionId);
    }

    // 2. Timestamp Visibility Barrier with multi-timeframe support.
    //    timeframeMinutes: 1 (default), 5, 15, 60, or 240.
    //    Fetch (500 * timeframeMinutes) raw 1m candles, then aggregate to produce ~500 bars.
    public async Task<List<CandlestickAggDto>> GetVisibleCandles(Guid sessionId, int timeframeMinutes = 1)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        // Clamp raw fetch count to a sane maximum
        int rawCount = Math.Min(500 * Math.Max(timeframeMinutes, 1), 5000);

        var candles = await _context.Candlesticks
            .Where(c => c.Symbol == session.Symbol && c.Timestamp <= session.CurrentReplayTimestamp)
            .OrderByDescending(c => c.Timestamp)
            .Take(rawCount)
            .ToListAsync();

        var sorted = candles.OrderBy(c => c.Timestamp).ToList();
        return _aggregation.AggregateCandles(sorted, timeframeMinutes);
    }

    // 3. Advance the replay clock — checks every 1m candle for TP/SL hits regardless of step size
    public async Task<StepResult> StepForward(Guid sessionId, int minutesToStep)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        for (int i = 0; i < minutesToStep; i++)
        {
            session.CurrentReplayTimestamp = session.CurrentReplayTimestamp.AddMinutes(1);

            var candle = await _context.Candlesticks
                .FirstOrDefaultAsync(c =>
                    c.Symbol == session.Symbol &&
                    c.Timestamp == session.CurrentReplayTimestamp);

            if (candle != null)
                await _tradeService.EvaluateOpenTrades(sessionId, candle);
        }

        await _context.Entry(session).ReloadAsync();
        await _context.SaveChangesAsync();
        return new StepResult(session.CurrentReplayTimestamp, session.CurrentBalance);
    }
}
