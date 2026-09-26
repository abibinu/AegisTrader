using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

public class DayOfWeekStat
{
    public string DayName { get; set; } = string.Empty;
    public int TradeCount { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal WinRate { get; set; }
}

public class SessionStat
{
    public string SessionName { get; set; } = string.Empty;
    public int TradeCount { get; set; }
    public decimal TotalPnL { get; set; }
    public decimal WinRate { get; set; }
}

/// <summary>
/// Data transfer object returned by the analytics endpoint.
/// Computed in-memory from closed trades with institutional metrics.
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
    public decimal MaxDrawdown { get; set; }       // In dollars
    public decimal MaxDrawdownPercent { get; set; } // Percentage of peak equity
    public decimal CurrentBalance { get; set; }
    public decimal InitialBalance { get; set; }

    // --- Institutional Quantitative Metrics ---
    public decimal SharpeRatio { get; set; }
    public decimal SortinoRatio { get; set; }
    public decimal Expectancy { get; set; }        // Expected $ per trade
    public decimal AvgRiskRewardRatio { get; set; }
    public decimal AvgWin { get; set; }
    public decimal AvgLoss { get; set; }
    public int MaxConsecutiveWins { get; set; }
    public int MaxConsecutiveLosses { get; set; }

    // --- Session Breakdown (Kill Zones) ---
    public SessionStat AsianSession { get; set; } = new();
    public SessionStat LondonKillZone { get; set; } = new();
    public SessionStat NewYorkKillZone { get; set; } = new();

    // --- Directional Bias Breakdown ---
    public int LongTradesCount { get; set; }
    public decimal LongPnL { get; set; }
    public decimal LongWinRate { get; set; }

    public int ShortTradesCount { get; set; }
    public decimal ShortPnL { get; set; }
    public decimal ShortWinRate { get; set; }

    // --- Day of Week Heatmap ---
    public List<DayOfWeekStat> DayOfWeekPerformance { get; set; } = new();

    // --- Equity Curve Data Points ---
    public List<decimal> EquityCurve { get; set; } = new();
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
        var session = await _context.TradingSessions.FindAsync(sessionId);

        var trades = await _context.Trades
            .Where(t => t.SessionId == sessionId && t.Status == TradeStatus.Closed)
            .OrderBy(t => t.ClosedAt)
            .ToListAsync();

        if (!trades.Any())
        {
            return new AnalyticsSummary
            {
                InitialBalance = session?.InitialBalance ?? 10000,
                CurrentBalance = session?.CurrentBalance ?? 10000,
                EquityCurve = new List<decimal> { session?.InitialBalance ?? 10000 }
            };
        }

        var winningTrades = trades.Where(t => t.PnL > 0).ToList();
        var losingTrades = trades.Where(t => t.PnL <= 0).ToList();

        var totalPnL = trades.Sum(t => t.PnL);
        var grossProfit = winningTrades.Sum(t => t.PnL);
        var grossLoss = Math.Abs(losingTrades.Sum(t => t.PnL));

        decimal initialBalance = session?.InitialBalance ?? 10000;
        decimal runningEquity = initialBalance;
        decimal peakEquity = initialBalance;
        decimal maxDrawdown = 0;
        decimal maxDrawdownPercent = 0;

        var equityCurve = new List<decimal> { initialBalance };

        foreach (var trade in trades)
        {
            runningEquity += trade.PnL;
            equityCurve.Add(runningEquity);

            if (runningEquity > peakEquity)
            {
                peakEquity = runningEquity;
            }

            decimal currentDrawdown = peakEquity - runningEquity;
            if (currentDrawdown > maxDrawdown)
            {
                maxDrawdown = currentDrawdown;
                maxDrawdownPercent = peakEquity > 0 ? (currentDrawdown / peakEquity) * 100 : 0;
            }
        }

        // --- Institutional Calculations ---
        decimal winRate = (decimal)winningTrades.Count / trades.Count * 100;
        decimal lossRate = (decimal)losingTrades.Count / trades.Count * 100;

        decimal avgWin = winningTrades.Count > 0 ? grossProfit / winningTrades.Count : 0;
        decimal avgLoss = losingTrades.Count > 0 ? grossLoss / losingTrades.Count : 0;

        // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
        decimal expectancy = ((winRate / 100m) * avgWin) - ((lossRate / 100m) * avgLoss);
        decimal avgRRR = avgLoss > 0 ? Math.Round(avgWin / avgLoss, 2) : 0;

        // --- Streak Metrics ---
        int maxConsecutiveWins = 0;
        int currentWins = 0;
        int maxConsecutiveLosses = 0;
        int currentLosses = 0;

        foreach (var trade in trades)
        {
            if (trade.PnL > 0)
            {
                currentWins++;
                currentLosses = 0;
                if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
            }
            else
            {
                currentLosses++;
                currentWins = 0;
                if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
            }
        }

        // --- Sharpe & Sortino Ratios ---
        var returns = trades.Select(t => (double)t.PnL).ToList();
        double avgReturn = returns.Average();

        double sumSquares = returns.Sum(r => Math.Pow(r - avgReturn, 2));
        double stdDev = returns.Count > 1 ? Math.Sqrt(sumSquares / (returns.Count - 1)) : 0;

        double downsideSquares = returns.Where(r => r < 0).Sum(r => Math.Pow(r, 2));
        double downsideStdDev = returns.Count > 1 ? Math.Sqrt(downsideSquares / returns.Count) : 0;

        // Annualize ratios assuming ~252 trading sessions scale factor
        decimal sharpeRatio = stdDev > 0 ? Math.Round((decimal)(avgReturn / stdDev * Math.Sqrt(252)), 2) : 0;
        decimal sortinoRatio = downsideStdDev > 0 ? Math.Round((decimal)(avgReturn / downsideStdDev * Math.Sqrt(252)), 2) : 0;

        // --- Session Breakdown (Kill Zones based on UTC Open Time) ---
        var asianTrades = trades.Where(t => t.OpenedAt.Hour >= 0 && t.OpenedAt.Hour < 6).ToList();
        var londonTrades = trades.Where(t => t.OpenedAt.Hour >= 7 && t.OpenedAt.Hour < 10).ToList();
        var nyTrades = trades.Where(t => t.OpenedAt.Hour >= 13 && t.OpenedAt.Hour < 16).ToList();

        SessionStat BuildSessionStat(string name, List<Trade> sessionTrades)
        {
            int count = sessionTrades.Count;
            if (count == 0) return new SessionStat { SessionName = name, TradeCount = 0, TotalPnL = 0, WinRate = 0 };
            int wins = sessionTrades.Count(t => t.PnL > 0);
            return new SessionStat
            {
                SessionName = name,
                TradeCount = count,
                TotalPnL = sessionTrades.Sum(t => t.PnL),
                WinRate = Math.Round((decimal)wins / count * 100, 1)
            };
        }

        // --- Directional Bias Breakdown ---
        var longTrades = trades.Where(t => t.Direction == TradeDirection.Buy).ToList();
        var shortTrades = trades.Where(t => t.Direction == TradeDirection.Sell).ToList();

        decimal longWinRate = longTrades.Count > 0 ? (decimal)longTrades.Count(t => t.PnL > 0) / longTrades.Count * 100 : 0;
        decimal shortWinRate = shortTrades.Count > 0 ? (decimal)shortTrades.Count(t => t.PnL > 0) / shortTrades.Count * 100 : 0;

        // --- Day of Week Heatmap ---
        var days = new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday };
        var dayStats = new List<DayOfWeekStat>();

        foreach (var day in days)
        {
            var dayTrades = trades.Where(t => t.OpenedAt.DayOfWeek == day).ToList();
            int count = dayTrades.Count;
            int wins = dayTrades.Count(t => t.PnL > 0);
            dayStats.Add(new DayOfWeekStat
            {
                DayName = day.ToString(),
                TradeCount = count,
                TotalPnL = dayTrades.Sum(t => t.PnL),
                WinRate = count > 0 ? Math.Round((decimal)wins / count * 100, 1) : 0
            });
        }

        return new AnalyticsSummary
        {
            TotalTrades = trades.Count,
            WinningTrades = winningTrades.Count,
            LosingTrades = losingTrades.Count,
            TotalPnL = totalPnL,
            GrossProfit = grossProfit,
            GrossLoss = grossLoss,
            WinRate = Math.Round(winRate, 1),
            ProfitFactor = grossLoss == 0 ? grossProfit : Math.Round(grossProfit / grossLoss, 2),
            MaxDrawdown = Math.Round(maxDrawdown, 2),
            MaxDrawdownPercent = Math.Round(maxDrawdownPercent, 2),
            CurrentBalance = session?.CurrentBalance ?? (initialBalance + totalPnL),
            InitialBalance = initialBalance,

            SharpeRatio = sharpeRatio,
            SortinoRatio = sortinoRatio,
            Expectancy = Math.Round(expectancy, 2),
            AvgRiskRewardRatio = avgRRR,
            AvgWin = Math.Round(avgWin, 2),
            AvgLoss = Math.Round(avgLoss, 2),
            MaxConsecutiveWins = maxConsecutiveWins,
            MaxConsecutiveLosses = maxConsecutiveLosses,

            AsianSession = BuildSessionStat("Asian Range (00-06 UTC)", asianTrades),
            LondonKillZone = BuildSessionStat("London Kill Zone (07-10 UTC)", londonTrades),
            NewYorkKillZone = BuildSessionStat("New York Kill Zone (13-16 UTC)", nyTrades),

            LongTradesCount = longTrades.Count,
            LongPnL = longTrades.Sum(t => t.PnL),
            LongWinRate = Math.Round(longWinRate, 1),

            ShortTradesCount = shortTrades.Count,
            ShortPnL = shortTrades.Sum(t => t.PnL),
            ShortWinRate = Math.Round(shortWinRate, 1),

            DayOfWeekPerformance = dayStats,
            EquityCurve = equityCurve
        };
    }
}