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
    private readonly AnalyticsService _analyticsService; 
    private readonly AegisDbContext _context;

    public TradeController(TradeService tradeService, AnalyticsService analyticsService, AegisDbContext context)
    {
        _tradeService = tradeService;
        _analyticsService = analyticsService;
        _context = context;
    }

    [HttpPost("open")]
    public async Task<IActionResult> OpenTrade(Guid sessionId, TradeDirection direction, decimal sl, decimal tp, decimal lots = 1.0m)
    {
        var session = await _context.TradingSessions.FindAsync(sessionId);
        if (session == null) return NotFound("Session not found");

        var lastCandle = await _context.Candlesticks
            .Where(c => c.Symbol == session.Symbol && c.Timestamp <= session.CurrentReplayTimestamp)
            .OrderByDescending(c => c.Timestamp)
            .FirstOrDefaultAsync();

        if (lastCandle == null) return BadRequest("No price data available.");

        var trade = await _tradeService.PlaceTrade(
            sessionId, 
            direction, 
            lastCandle.Close, 
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

    [HttpGet("analytics/{sessionId}")]
    public async Task<IActionResult> GetAnalytics(Guid sessionId)
    {
        var summary = await _analyticsService.GetSessionSummary(sessionId);
        return Ok(summary);
    }
}