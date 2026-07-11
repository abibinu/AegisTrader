using AegisTrader.API.Data;
using AegisTrader.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeedController : ControllerBase
{
    private readonly DataImportService _importService;
    private readonly AegisDbContext _context;

    public SeedController(DataImportService importService, AegisDbContext context)
    {
        _importService = importService;
        _context = context;
    }

    /// <summary>
    /// Returns a diagnostic summary of seeded candle data.
    /// Anonymous — used by the frontend header to show DB health before login.
    /// GET /api/Seed/status?symbol=EURUSD
    /// </summary>
    [AllowAnonymous]
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus([FromQuery] string symbol = "EURUSD")
    {
        var count = await _context.Candlesticks
            .Where(c => c.Symbol == symbol)
            .CountAsync();

        if (count == 0)
            return Ok(new { symbol, count = 0, message = $"No data seeded for {symbol}" });

        var earliest = await _context.Candlesticks
            .Where(c => c.Symbol == symbol)
            .MinAsync(c => c.Timestamp);

        var latest = await _context.Candlesticks
            .Where(c => c.Symbol == symbol)
            .MaxAsync(c => c.Timestamp);

        return Ok(new
        {
            symbol,
            count,
            earliestCandle = earliest,
            latestCandle   = latest,
            message        = $"✅ {count:N0} candles available from {earliest:yyyy-MM-dd} to {latest:yyyy-MM-dd}"
        });
    }

    // Option 1: Import a single CSV file
    [HttpPost("import-file")]
    public async Task<IActionResult> ImportFile([FromQuery] string filePath, [FromQuery] string symbol = "EURUSD")
    {
        try
        {
            await _importService.ImportCsvData(filePath, symbol);
            return Ok($"File {Path.GetFileName(filePath)} imported successfully.");
        }
        catch (Exception ex)
        {
            return BadRequest($"Error: {ex.Message}");
        }
    }

    // Option 2: Import every CSV in a folder
    [HttpPost("import-folder")]
    public async Task<IActionResult> ImportFolder([FromQuery] string folderPath, [FromQuery] string symbol = "EURUSD")
    {
        try
        {
            await _importService.ImportDirectory(folderPath, symbol);
            return Ok($"Folder {folderPath} processed successfully.");
        }
        catch (Exception ex)
        {
            return BadRequest($"Error: {ex.Message}");
        }
    }
}