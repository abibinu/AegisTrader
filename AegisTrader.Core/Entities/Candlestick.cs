using System.ComponentModel.DataAnnotations;

namespace AegisTrader.Core.Entities;

public class Candlestick
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(10)]
    public string Symbol { get; set; } = string.Empty; // e.g., EURUSD
    
    [Required]
    public DateTime Timestamp { get; set; }
    
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public decimal Volume { get; set; }
}