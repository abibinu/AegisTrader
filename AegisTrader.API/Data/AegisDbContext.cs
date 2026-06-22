using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AegisTrader.API.Data;

public class AegisDbContext : DbContext
{
    public AegisDbContext(DbContextOptions<AegisDbContext> options) : base(options) { }

    // Define the tables
    public DbSet<User> Users { get; set; }
    public DbSet<Candlestick> Candlesticks { get; set; }
    // We will add TradingSession and Trade in the next sub-step

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Optimization: Ensure Candlesticks are indexed by Symbol and Timestamp for fast replay lookups
        modelBuilder.Entity<Candlestick>()
            .HasIndex(c => new { c.Symbol, c.Timestamp });

        // Precision for Financial Decimals (Forex requirement)
        foreach (var property in modelBuilder.Model.GetEntityTypes()
            .SelectMany(t => t.GetProperties())
            .Where(p => p.ClrType == typeof(decimal)))
        {
            property.SetColumnType("decimal(18,5)");
        }
    }
}