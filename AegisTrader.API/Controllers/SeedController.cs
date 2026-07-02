using AegisTrader.API.Data;
using AegisTrader.API.Services;
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
    /// Imports a Dukascopy semicolon-delimited CSV into the Candlesticks table.
    /// Format per line: 20260501 001800;1.12345;1.12360;1.12330;1.12350;100
    /// </summary>
    [HttpPost("import-eurusd")]
    public async Task<IActionResult> ImportData([FromQuery] string filePath)
    {
        try 
        {
            await _importService.ImportCsvData(filePath, "EURUSD");
            return Ok("Data imported successfully.");
        }
        catch (Exception ex)
        {
            return BadRequest($"Error: {ex.Message}");
        }
    }

    /// <summary>
    /// DIAGNOSTIC ENDPOINT — Call this from the browser or frontend to verify 
    /// that the database has been seeded before starting a session.
    /// 
    /// Returns: symbol, total count of candles, and the date range.
    /// GET /api/Seed/status?symbol=EURUSD
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus([FromQuery] string symbol = "EURUSD")
    {
        var count = await _context.Candlesticks
            .Where(c => c.Symbol == symbol)
            .CountAsync();

        if (count == 0)
        {
            return Ok(new { symbol, count, message = "No data found. Run the import endpoint first." });
        }

        // Get the earliest and latest timestamps for this symbol
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
            latestCandle = latest,
            message = $"✅ {count:N0} candles available from {earliest:yyyy-MM-dd} to {latest:yyyy-MM-dd}"
        });
    }
}