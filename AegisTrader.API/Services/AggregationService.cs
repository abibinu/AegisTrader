using AegisTrader.Core.Entities;

namespace AegisTrader.API.Services;

/// <summary>
/// Aggregates a list of 1-minute Candlestick records into any N-minute OHLCV candles.
/// Used by both the Replay and Live endpoints to support multi-timeframe chart views.
/// </summary>
public class AggregationService
{
    /// <summary>
    /// Groups 1-minute candles into N-minute candles.
    /// Input candles must be sorted ascending by Timestamp.
    ///
    /// Aggregation rules:
    ///   Open      = Open of the FIRST 1m candle in the bucket
    ///   High      = MAX High across all 1m candles in the bucket
    ///   Low       = MIN Low across all 1m candles in the bucket
    ///   Close     = Close of the LAST 1m candle in the bucket
    ///   Volume    = SUM of all Volumes in the bucket
    ///   Timestamp = Timestamp of the FIRST 1m candle in the bucket (bar open time)
    /// </summary>
    public List<CandlestickAggDto> AggregateCandles(IEnumerable<Candlestick> oneMinuteCandles, int timeframeMinutes)
    {
        if (timeframeMinutes <= 1)
        {
            return oneMinuteCandles.Select(c => new CandlestickAggDto
            {
                Symbol    = c.Symbol,
                Timestamp = c.Timestamp,
                Open      = c.Open,
                High      = c.High,
                Low       = c.Low,
                Close     = c.Close,
                Volume    = c.Volume
            }).ToList();
        }

        // Group 1m candles into N-minute buckets using integer division on epoch-minutes.
        var grouped = oneMinuteCandles
            .GroupBy(c =>
            {
                long epochMinutes = (long)(c.Timestamp - DateTime.UnixEpoch).TotalMinutes;
                return epochMinutes / timeframeMinutes;
            })
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var sorted = g.OrderBy(c => c.Timestamp).ToList();
                return new CandlestickAggDto
                {
                    Symbol    = sorted.First().Symbol,
                    Timestamp = sorted.First().Timestamp,
                    Open      = sorted.First().Open,
                    High      = sorted.Max(c => c.High),
                    Low       = sorted.Min(c => c.Low),
                    Close     = sorted.Last().Close,
                    Volume    = sorted.Sum(c => c.Volume)
                };
            })
            .ToList();

        return grouped;
    }
}

/// <summary>
/// DTO for aggregated candles with lowercase JSON serialization matching frontend expectations.
/// </summary>
public record CandlestickAggDto
{
    public string   Symbol    { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public decimal  Open      { get; init; }
    public decimal  High      { get; init; }
    public decimal  Low       { get; init; }
    public decimal  Close     { get; init; }
    public decimal  Volume    { get; init; }
}
