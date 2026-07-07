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