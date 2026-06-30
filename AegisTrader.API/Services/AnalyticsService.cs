using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

public class AnalyticsSummary
{
    public int TotalTrades { get; set; }
    public decimal WinRate { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal ProfitFactor { get; set; }
    public decimal MaxDrawdown { get; set; }
}

public class AnalyticsService
{
    private readonly AegisDbContext _context;

    public AnalyticsService(AegisDbContext context)
    {
        _context = context;
    }

    public async Task<AnalyticsSummary> GetSessionSummary(Guid sessionId)
    {
        var trades = await _context.Trades
            .Where(t => t.SessionId == sessionId && t.Status == TradeStatus.Closed)
            .ToListAsync();

        if (!trades.Any()) return new AnalyticsSummary();

        var winningTrades = trades.Where(t => t.PnL > 0).ToList();
        var losingTrades = trades.Where(t => t.PnL < 0).ToList();

        var totalPnL = trades.Sum(t => t.PnL);
        var grossProfit = winningTrades.Sum(t => t.PnL);
        var grossLoss = Math.Abs(losingTrades.Sum(t => t.PnL));

        return new AnalyticsSummary
        {
            TotalTrades = trades.Count,
            TotalPnL = totalPnL,
            WinRate = (decimal)winningTrades.Count / trades.Count * 100,
            // Profit Factor = Gross Profit / Gross Loss
            ProfitFactor = grossLoss == 0 ? grossProfit : grossProfit / grossLoss,
            MaxDrawdown = 0 // We will implement the complex Drawdown logic later
        };
    }
}