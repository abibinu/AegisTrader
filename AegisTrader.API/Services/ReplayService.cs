using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

// DTO returned by StepForward so the frontend gets both time AND balance in one call.
// Previously only DateTime was returned, so the frontend could never sync the balance.
public record StepResult(DateTime CurrentTime, decimal CurrentBalance);

public class ReplayService
{
    private readonly AegisDbContext _context;
    private readonly TradeService _tradeService;

    public ReplayService(AegisDbContext context, TradeService tradeService)
    {
        _context = context;
        _tradeService = tradeService;
    }

    // 1. Start a new session — balance defaults to $10,000
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

    // 2. The Timestamp Visibility Barrier — the core anti-look-ahead mechanism.
    // FIX: Increased from Take(200) to Take(500) so the chart shows ~8 hours of
    // 1-minute history at a time, giving much richer context for ICT/SMC analysis.
    public async Task<List<Candlestick>> GetVisibleCandles(Guid sessionId)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        // Fetch the latest 500 candles UP TO the current replay timestamp.
        // Descending sort + Take(N) is the most efficient approach for SQL databases.
        var candles = await _context.Candlesticks
            .Where(c => c.Symbol == session.Symbol && c.Timestamp <= session.CurrentReplayTimestamp)
            .OrderByDescending(c => c.Timestamp)
            .Take(500)
            .ToListAsync();

        // Re-sort ascending so the chart renders left-to-right chronologically.
        return candles.OrderBy(c => c.Timestamp).ToList();
    }

    // 3. Advance the replay clock
    // FIX: Now returns StepResult (time + balance) instead of just DateTime,
    // so the frontend can sync the account balance after each step.
    public async Task<StepResult> StepForward(Guid sessionId, int minutesToStep)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        // Advance 1 minute at a time — this is intentional.
        // If you jump forward 240 minutes (+4H) in one call, we still check every
        // individual candle for TP/SL hits. This prevents missing trade closures
        // inside the stepped gap.
        for (int i = 0; i < minutesToStep; i++)
        {
            session.CurrentReplayTimestamp = session.CurrentReplayTimestamp.AddMinutes(1);

            var candle = await _context.Candlesticks
                .FirstOrDefaultAsync(c =>
                    c.Symbol == session.Symbol &&
                    c.Timestamp == session.CurrentReplayTimestamp);

            if (candle != null)
            {
                // EvaluateOpenTrades now also updates session.CurrentBalance in-place.
                await _tradeService.EvaluateOpenTrades(sessionId, candle);
            }
        }

        // Reload session to get the latest CurrentBalance after all trade closes
        await _context.Entry(session).ReloadAsync();
        await _context.SaveChangesAsync();

        return new StepResult(session.CurrentReplayTimestamp, session.CurrentBalance);
    }
}