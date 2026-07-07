using System.Globalization;
using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

public class DataImportService
{
    private readonly AegisDbContext _context;

    public DataImportService(AegisDbContext context)
    {
        _context = context;
    }

    // New: Method to import every CSV in a folder
    public async Task ImportDirectory(string directoryPath, string symbol)
    {
        var files = Directory.GetFiles(directoryPath, "*.csv");
        Console.WriteLine($"Found {files.Length} files in directory.");

        foreach (var file in files)
        {
            Console.WriteLine($">>> Processing: {Path.GetFileName(file)}");
            await ImportCsvData(file, symbol);
        }
    }

    // Public method for a single file (This fixes your red error!)
    public async Task ImportCsvData(string filePath, string symbol)
    {
        var candlesticks = new List<Candlestick>();
        using var reader = new StreamReader(filePath);
        string? line;

        while ((line = await reader.ReadLineAsync()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var values = line.Split(';'); 
            if (values.Length < 5) continue;

            try 
            {
                var timestamp = DateTime.ParseExact(values[0], "yyyyMMdd HHmmss", CultureInfo.InvariantCulture);

                candlesticks.Add(new Candlestick {
                    Symbol = symbol,
                    Timestamp = DateTime.SpecifyKind(timestamp, DateTimeKind.Utc),
                    Open = decimal.Parse(values[1], CultureInfo.InvariantCulture),
                    High = decimal.Parse(values[2], CultureInfo.InvariantCulture),
                    Low = decimal.Parse(values[3], CultureInfo.InvariantCulture),
                    Close = decimal.Parse(values[4], CultureInfo.InvariantCulture),
                    Volume = values.Length > 5 ? decimal.Parse(values[5], CultureInfo.InvariantCulture) : 0
                });
            }
            catch { continue; }

            // Batch save every 2000 rows for high performance
            if (candlesticks.Count >= 2000)
            {
                await _context.Candlesticks.AddRangeAsync(candlesticks);
                await _context.SaveChangesAsync();
                candlesticks.Clear();
            }
        }

        if (candlesticks.Any())
        {
            await _context.Candlesticks.AddRangeAsync(candlesticks);
            await _context.SaveChangesAsync();
        }
    }
}