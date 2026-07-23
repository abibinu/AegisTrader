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

    public LivePriceController(LivePriceCache priceCache, AegisDbContext context)
    {
        _priceCache = priceCache;
        _context = context;
    }

    /// <summary>
    /// Returns the last N historical candles as a baseline context for the Live Sandbox chart.
    /// GET /api/LivePrice/history?symbol=EURUSD&count=500
    /// </summary>
    [AllowAnonymous]
    [HttpGet("history")]
    public async Task<IActionResult> GetLiveHistory(
        [FromQuery] string symbol = "EURUSD",
        [FromQuery] int count = 500)
    {
        // Clamp to a safe range: minimum 50, maximum 2000 candles
        count = Math.Max(50, Math.Min(count, 2000));

        var candles = await _context.Candlesticks
            .Where(c => c.Symbol == symbol)
            .OrderByDescending(c => c.Timestamp)
            .Take(count)
            .ToListAsync();

        return Ok(candles.OrderBy(c => c.Timestamp).ToList());
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
    public IActionResult GetLatestPrice([FromQuery] string symbol = "EURUSD")
    {
        var tick = _priceCache.GetPrice(symbol);
        if (tick == null)
        {
            // Seed a reasonable default if bridge isn't running yet (cold start fallback)
            return Ok(new
            {
                Symbol = symbol.ToUpperInvariant(),
                Bid = 1.08500m,
                Ask = 1.08512m,
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
