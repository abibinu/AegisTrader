using System.Security.Claims;
using AegisTrader.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AegisTrader.API.Controllers;

/// <summary>
/// All Replay endpoints require a valid JWT.
/// LEARNING: [Authorize] on the class means EVERY method inside is protected.
/// The JWT middleware runs first, validates the token, and populates
/// HttpContext.User with the claims. If no valid token is present,
/// ASP.NET Core automatically returns 401 Unauthorized before the method runs.
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ReplayController : ControllerBase
{
    private readonly ReplayService _replayService;

    public ReplayController(ReplayService replayService)
    {
        _replayService = replayService;
    }

    /// <summary>
    /// Helper: Extracts the UserId from the validated JWT claims.
    /// 
    /// LEARNING: HttpContext.User is a ClaimsPrincipal populated by the
    /// JWT middleware. ClaimTypes.NameIdentifier is the standard claim
    /// we embedded in the token when the user logged in — it contains their Guid.
    /// </summary>
    private Guid GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartSession(string symbol, DateTime startTime)
    {
        // Real UserId extracted from JWT — no more Guid.Empty placeholder!
        var userId = GetUserId();
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
        var result = await _replayService.StepForward(sessionId, minutes);
        return Ok(result);
    }
}