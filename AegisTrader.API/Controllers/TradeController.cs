using AegisTrader.API.Data;
using AegisTrader.API.Services;
using AegisTrader.Core.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TradeController : ControllerBase
{
    private readonly TradeService _tradeService;
    private readonly AegisDbContext _context;

    public TradeController(TradeService tradeService, AegisDbContext context)
    {
        _tradeService = tradeService;
        _context = context;
    }

    [HttpPost("open")]
    public async Task<IActionResult> OpenTrade(Guid sessionId, TradeDirection direction, decimal sl, decimal tp, decimal lots = 1.0m)
    {
        // 1. Get the session to find the current "Time Machine" price
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) return NotFound("Session not found");

        // 2. Get the most recent candle to determine Entry Price
        var lastCandle = await _context.Candlesticks
            .Where(c => c.Symbol == session.Symbol && c.Timestamp <= session.CurrentReplayTimestamp)
            .OrderByDescending(c => c.Timestamp)
            .FirstOrDefaultAsync();

        if (lastCandle == null) return BadRequest("No price data available for this session time.");

        // We use the 'Close' of the current candle as our entry price
        var entryPrice = lastCandle.Close;

        // 3. Place the trade
        var trade = await _tradeService.PlaceTrade(
            sessionId, 
            direction, 
            entryPrice, 
            sl, 
            tp, 
            lots, 
            session.CurrentReplayTimestamp
        );

        return Ok(trade);
    }

    [HttpGet("history/{sessionId}")]
    public async Task<IActionResult> GetTradeHistory(Guid sessionId)
    {
        var trades = await _context.Trades
            .Where(t => t.SessionId == sessionId)
            .OrderByDescending(t => t.OpenedAt)
            .ToListAsync();
            
        return Ok(trades);
    }
}