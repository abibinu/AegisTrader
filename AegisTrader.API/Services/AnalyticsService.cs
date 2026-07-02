using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

/// <summary>
/// Data transfer object returned by the analytics endpoint.
/// This is NOT a database entity — it's computed in-memory from closed trades.
/// </summary>
public class AnalyticsSummary
{
    public int TotalTrades { get; set; }
    public int WinningTrades { get; set; }
    public int LosingTrades { get; set; }
    public decimal WinRate { get; set; }          // Percentage, e.g., 55.0
    public decimal TotalPnL { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal GrossLoss { get; set; }
    public decimal ProfitFactor { get; set; }
    public decimal MaxDrawdown { get; set; }       // In dollars, always positive
    public decimal MaxDrawdownPercent { get; set; } // As percentage of peak equity
    public decimal CurrentBalance { get; set; }
    public decimal InitialBalance { get; set; }
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
        // Fetch the session for balance info
        var session = await _context.TradingSessions.FindAsync(sessionId);

        // Fetch all CLOSED trades, ordered by close time to build an equity curve
        var trades = await _context.Trades
            .Where(t => t.SessionId == sessionId && t.Status == TradeStatus.Closed)
            .OrderBy(t => t.ClosedAt)  // ← Important: ordered for equity curve
            .ToListAsync();

        if (!trades.Any())
        {
            return new AnalyticsSummary
            {
                InitialBalance = session?.InitialBalance ?? 10000,
                CurrentBalance = session?.CurrentBalance ?? 10000,
            };
        }

        var winningTrades = trades.Where(t => t.PnL > 0).ToList();
        var losingTrades = trades.Where(t => t.PnL <= 0).ToList();

        var totalPnL = trades.Sum(t => t.PnL);
        var grossProfit = winningTrades.Sum(t => t.PnL);
        var grossLoss = Math.Abs(losingTrades.Sum(t => t.PnL));

        // --- MAX DRAWDOWN: Peak-to-Trough Equity Curve Algorithm ---
        // LEARNING NOTE:
        // We simulate a running equity curve starting from InitialBalance.
        // At each closed trade we add its P&L. We track:
        //   peakEquity  = the highest balance we've ever reached
        //   currentDD   = how far we've fallen from that peak right now
        //   maxDD       = the worst currentDD we've ever seen
        //
        // Example:
        //   Start: 10000 → Peak: 10000
        //   Trade +200 → Balance: 10200 → new Peak: 10200, DD: 0
        //   Trade -150 → Balance: 10050 → still below 10200, DD: 150
        //   Trade -100 → Balance: 9950  → DD: 250  ← new worst DD
        //   Trade +400 → Balance: 10350 → new Peak: 10350, DD: 0
        //   MaxDrawdown = $250

        decimal initialBalance = session?.InitialBalance ?? 10000;
        decimal runningEquity = initialBalance;
        decimal peakEquity = initialBalance;
        decimal maxDrawdown = 0;
        decimal maxDrawdownPercent = 0;

        foreach (var trade in trades)
        {
            runningEquity += trade.PnL;

            if (runningEquity > peakEquity)
            {
                peakEquity = runningEquity; // New high watermark
            }

            decimal currentDrawdown = peakEquity - runningEquity;
            if (currentDrawdown > maxDrawdown)
            {
                maxDrawdown = currentDrawdown;
                // Drawdown as a % of the peak equity at that moment
                maxDrawdownPercent = peakEquity > 0 ? (currentDrawdown / peakEquity) * 100 : 0;
            }
        }

        return new AnalyticsSummary
        {
            TotalTrades = trades.Count,
            WinningTrades = winningTrades.Count,
            LosingTrades = losingTrades.Count,
            TotalPnL = totalPnL,
            GrossProfit = grossProfit,
            GrossLoss = grossLoss,
            WinRate = (decimal)winningTrades.Count / trades.Count * 100,
            // Profit Factor: How many dollars of profit per dollar of loss
            // e.g., PF=2.5 means for every $1 lost, you made $2.50
            ProfitFactor = grossLoss == 0 ? grossProfit : Math.Round(grossProfit / grossLoss, 2),
            MaxDrawdown = Math.Round(maxDrawdown, 2),
            MaxDrawdownPercent = Math.Round(maxDrawdownPercent, 2),
            CurrentBalance = session?.CurrentBalance ?? (initialBalance + totalPnL),
            InitialBalance = initialBalance,
        };
    }
}