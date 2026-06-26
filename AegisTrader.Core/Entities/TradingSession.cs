using System.ComponentModel.DataAnnotations;

namespace AegisTrader.Core.Entities;

public enum SessionType { Replay, LivePaper }

public class TradingSession
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid UserId { get; set; }
    
    [Required]
    public string Symbol { get; set; } = "EURUSD";
    
    public SessionType Type { get; set; } = SessionType.Replay;
    
    public decimal InitialBalance { get; set; } = 10000;
    public decimal CurrentBalance { get; set; }
    
    // The "Time Machine" pointer
    public DateTime CurrentReplayTimestamp { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}