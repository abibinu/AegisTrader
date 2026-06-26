using AegisTrader.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace AegisTrader.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReplayController : ControllerBase
{
    private readonly ReplayService _replayService;

    public ReplayController(ReplayService replayService)
    {
        _replayService = replayService;
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartSession(string symbol, DateTime startTime)
    {
        // For now, we use a fixed Guid for the user until we add Auth
        var userId = Guid.Empty; 
        var session = await _replayService.CreateSession(userId, symbol, startTime);
        return Ok(session);
    }

    [HttpGet("{sessionId}/candles")]
    public async Task<IActionResult> GetCandles(Guid sessionId)
    {
        var candles = await _replayService.GetVisibleCandles(sessionId);
        return Ok(candles);
    }

    [HttpPost("{sessionId}/step")]
    public async Task<IActionResult> StepForward(Guid sessionId, [FromQuery] int minutes = 1)
    {
        var newTime = await _replayService.StepForward(sessionId, minutes);
        return Ok(new { CurrentTime = newTime });
    }
}