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

    /// <summary>
    /// Generates realistic synthetic 1-minute historical candles for supported assets when no CSV is present.
    /// </summary>
    public async Task GenerateSyntheticCandlesAsync(string symbol, int count = 5000)
    {
        var sym = symbol.ToUpperInvariant();
        bool exists = await _context.Candlesticks.AnyAsync(c => c.Symbol == sym);
        if (exists) return;

        decimal currentPrice = sym switch
        {
            "GBPUSD" => 1.28500m,
            "USDJPY" => 154.500m,
            "AUDUSD" => 0.65500m,
            "XAUUSD" => 2650.00m,
            "BTCUSD" => 68500.00m,
            _        => 1.08500m // EURUSD
        };

        decimal stepVolatility = sym switch
        {
            "GBPUSD" => 0.00022m,
            "USDJPY" => 0.035m,
            "AUDUSD" => 0.00014m,
            "XAUUSD" => 0.85m,
            "BTCUSD" => 38.0m,
            _        => 0.00018m // EURUSD
        };

        var rng = new Random(sym.GetHashCode());
        var startTime = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var candles = new List<Candlestick>();

        for (int i = 0; i < count; i++)
        {
            double changePct = (rng.NextDouble() - 0.495) * (double)stepVolatility;
            decimal openP = currentPrice;
            decimal closeP = Math.Max(0.00001m, openP + (decimal)changePct);
            
            decimal highP = Math.Max(openP, closeP) + (decimal)(rng.NextDouble() * 0.5 * (double)stepVolatility);
            decimal lowP  = Math.Min(openP, closeP) - (decimal)(rng.NextDouble() * 0.5 * (double)stepVolatility);
            lowP = Math.Max(0.00001m, lowP);

            currentPrice = closeP;

            candles.Add(new Candlestick
            {
                Symbol    = sym,
                Timestamp = startTime.AddMinutes(i),
                Open      = Math.Round(openP, 5),
                High      = Math.Round(highP, 5),
                Low       = Math.Round(lowP, 5),
                Close     = Math.Round(closeP, 5),
                Volume    = rng.Next(15, 350)
            });

            if (candles.Count >= 2000)
            {
                await _context.Candlesticks.AddRangeAsync(candles);
                await _context.SaveChangesAsync();
                candles.Clear();
            }
        }

        if (candles.Any())
        {
            await _context.Candlesticks.AddRangeAsync(candles);
            await _context.SaveChangesAsync();
        }
    }
}