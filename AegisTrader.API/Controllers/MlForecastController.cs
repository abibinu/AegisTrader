using AegisTrader.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AegisTrader.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MlForecastController : ControllerBase
{
    private readonly MlForecastingService _forecastingService;

    public MlForecastController(MlForecastingService forecastingService)
    {
        _forecastingService = forecastingService;
    }

    /// <summary>
    /// Executes Machine Learning inference on the current Replay session clock state (zero-lookahead compliant).
    /// GET /api/MlForecast/replay/{sessionId}?timeframeMinutes=1&lookback=200
    /// </summary>
    [AllowAnonymous]
    [HttpGet("replay/{sessionId:guid}")]
    public async Task<IActionResult> GetReplayForecast(
        Guid sessionId,
        [FromQuery] int timeframeMinutes = 1,
        [FromQuery] int lookback = 200)
    {
        try
        {
            var result = await _forecastingService.PredictForSessionAsync(sessionId, timeframeMinutes, lookback);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Inference engine error: " + ex.Message });
        }
    }

    /// <summary>
    /// Executes Machine Learning inference for Live Paper Trading using latest market candles.
    /// GET /api/MlForecast/live?symbol=EURUSD&timeframeMinutes=1&count=200
    /// </summary>
    [AllowAnonymous]
    [HttpGet("live")]
    public async Task<IActionResult> GetLiveForecast(
        [FromQuery] string symbol = "EURUSD",
        [FromQuery] int timeframeMinutes = 1,
        [FromQuery] int count = 200)
    {
        try
        {
            var result = await _forecastingService.PredictForSymbolAsync(symbol, timeframeMinutes, count);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Inference engine error: " + ex.Message });
        }
    }
}
