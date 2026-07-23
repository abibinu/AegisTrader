using System.Collections.Concurrent;

namespace AegisTrader.API.Services;

public class LivePriceTick
{
    public string Symbol { get; set; } = string.Empty;
    public decimal Bid { get; set; }
    public decimal Ask { get; set; }
    public DateTime Timestamp { get; set; }
}

public class LivePriceCache
{
    private readonly ConcurrentDictionary<string, LivePriceTick> _cache = new();

    public void UpdatePrice(string symbol, decimal bid, decimal ask)
    {
        var symbolUpper = symbol.ToUpperInvariant();
        var tick = new LivePriceTick
        {
            Symbol = symbolUpper,
            Bid = bid,
            Ask = ask,
            Timestamp = DateTime.UtcNow
        };

        _cache[symbolUpper] = tick;
    }

    public LivePriceTick? GetPrice(string symbol)
    {
        var symbolUpper = symbol.ToUpperInvariant();
        return _cache.TryGetValue(symbolUpper, out var tick) ? tick : null;
    }

    public List<LivePriceTick> GetAllPrices()
    {
        return _cache.Values.ToList();
    }
}
