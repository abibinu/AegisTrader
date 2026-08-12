using AegisTrader.API.Data;
using AegisTrader.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LivePriceController : ControllerBase
{
    private readonly LivePriceCache _priceCache;
    private readonly AegisDbContext _context;
    private readonly AggregationService _aggregation;

    public LivePriceController(LivePriceCache priceCache, AegisDbContext context, AggregationService aggregation)
    {
        _priceCache  = priceCache;
        _context     = context;
        _aggregation = aggregation;
    }

    /// <summary>
    /// Returns the last N aggregated candles as a baseline context for the Live Sandbox chart.
    /// GET /api/LivePrice/history?symbol=EURUSD&count=500&timeframe=1
    /// timeframe: 1 (1m), 5 (5m), 15 (15m), 60 (1H), 240 (4H)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("history")]
    public async Task<IActionResult> GetLiveHistory(
        [FromQuery] string symbol = "EURUSD",
        [FromQuery] int count = 500,
        [FromQuery] int timeframe = 1)
    {
        // Clamp aggregated output bars to a safe range: 50–500
        count = Math.Max(50, Math.Min(count, 500));
        // Ensure timeframe is a valid value
        timeframe = timeframe <= 1 ? 1 : timeframe;

        // Fetch enough raw 1m candles to produce ~count aggregated bars.
        // Cap at 150,000 to support 4H (500 bars × 240 min = 120,000 raw candles).
        int rawCount = Math.Min(count * timeframe, 150_000);

        var candles = await _context.Candlesticks
            .Where(c => c.Symbol == symbol)
            .OrderByDescending(c => c.Timestamp)
            .Take(rawCount)
            .ToListAsync();

        var sorted = candles.OrderBy(c => c.Timestamp).ToList();
        var aggregated = _aggregation.AggregateCandles(sorted, timeframe);

        return Ok(aggregated);
    }

    /// <summary>
    /// Endpoint for local Python/MT5 Bridge script to inject real-time ticks.
    /// POST /api/LivePrice/tick
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tick")]
    public IActionResult UpdateTick([FromBody] LivePriceTickRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Symbol))
            return BadRequest("Symbol is required.");

        if (request.Bid <= 0 || request.Ask <= 0)
            return BadRequest("Bid and Ask must be positive values.");

        _priceCache.UpdatePrice(request.Symbol, request.Bid, request.Ask);
        return Ok(new { Message = "Tick updated successfully." });
    }

    /// <summary>
    /// Endpoint for React frontend to retrieve latest cached tick values.
    /// GET /api/LivePrice/latest
    /// </summary>
    [AllowAnonymous]
    [HttpGet("latest")]
    public async Task<IActionResult> GetLatestPrice([FromQuery] string symbol = "EURUSD")
    {
        var tick = _priceCache.GetPrice(symbol);
        if (tick == null)
        {
            // Seed baseline from latest DB candle if bridge isn't running yet (cold start fallback)
            var latestDbCandle = await _context.Candlesticks
                .Where(c => c.Symbol == symbol)
                .OrderByDescending(c => c.Timestamp)
                .FirstOrDefaultAsync();

            decimal defaultBid = latestDbCandle != null ? latestDbCandle.Close : 1.13850m;
            decimal defaultAsk = defaultBid + 0.00012m;

            _priceCache.UpdatePrice(symbol, defaultBid, defaultAsk);

            return Ok(new
            {
                Symbol = symbol.ToUpperInvariant(),
                Bid = defaultBid,
                Ask = defaultAsk,
                Timestamp = DateTime.UtcNow,
                IsPlaceholder = true
            });
        }

        return Ok(tick);
    }
}

public class LivePriceTickRequest
{
    public string Symbol { get; set; } = string.Empty;
    public decimal Bid { get; set; }
    public decimal Ask { get; set; }
}
