using AegisTrader.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace AegisTrader.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeedController : ControllerBase
{
    private readonly DataImportService _importService;

    public SeedController(DataImportService importService)
    {
        _importService = importService;
    }

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
}