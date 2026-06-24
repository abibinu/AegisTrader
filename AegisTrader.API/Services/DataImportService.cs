using System.Globalization;
using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Services;

public class DataImportService
{
    private readonly AegisDbContext _context;

    // The Constructor: This "injects" the database context so the service can save data.
    public DataImportService(AegisDbContext context)
    {
        _context = context;
    }

    public async Task ImportCsvData(string filePath, string symbol)
    {
        // 1. Safety Check: Don't import if data for this symbol already exists
        if (await _context.Candlesticks.AnyAsync(c => c.Symbol == symbol))
        {
            Console.WriteLine($"Data for {symbol} already exists. Skipping import.");
            return;
        }

        var candlesticks = new List<Candlestick>();
        
        // 2. Open the file. 'using' ensures the file is closed automatically even if an error occurs.
        using var reader = new StreamReader(filePath);

        string? line;
        Console.WriteLine($"Starting import for {symbol}...");

        // 3. The Async-Safe Loop: Read line by line until the end of the file
        while ((line = await reader.ReadLineAsync()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            // Split by semicolon (;) as per your file format
            var values = line.Split(';'); 
            if (values.Length < 5) continue;

            try 
            {
                // 4. Parse the specific date format: 20260501 001800
                var timestamp = DateTime.ParseExact(values[0], "yyyyMMdd HHmmss", CultureInfo.InvariantCulture);

                var candle = new Candlestick
                {
                    Symbol = symbol,
                    // .NET core works best with UTC times for databases
                    Timestamp = DateTime.SpecifyKind(timestamp, DateTimeKind.Utc),
                    Open = decimal.Parse(values[1], CultureInfo.InvariantCulture),
                    High = decimal.Parse(values[2], CultureInfo.InvariantCulture),
                    Low = decimal.Parse(values[3], CultureInfo.InvariantCulture),
                    Close = decimal.Parse(values[4], CultureInfo.InvariantCulture),
                    // If volume index 5 exists, use it, otherwise default to 0
                    Volume = values.Length > 5 ? decimal.Parse(values[5], CultureInfo.InvariantCulture) : 0
                };

                candlesticks.Add(candle);
            }
            catch (Exception ex)
            {
                // Log the error for a specific line but keep processing the rest of the file
                Console.WriteLine($"Error parsing line: {line}. Error: {ex.Message}");
                continue;
            }

            // 5. Batch Insert: Every 1000 records, push to the database.
            // This prevents the application from using too much RAM.
            if (candlesticks.Count >= 1000)
            {
                await _context.Candlesticks.AddRangeAsync(candlesticks);
                await _context.SaveChangesAsync();
                candlesticks.Clear();
                Console.WriteLine("Imported another 1000 rows...");
            }
        }

        // 6. Final Save: Push any remaining rows (the last batch) to the database
        if (candlesticks.Any())
        {
            await _context.Candlesticks.AddRangeAsync(candlesticks);
            await _context.SaveChangesAsync();
        }

        Console.WriteLine("Import process complete.");
    }
}