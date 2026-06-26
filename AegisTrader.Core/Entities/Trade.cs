using System.ComponentModel.DataAnnotations;

namespace AegisTrader.Core.Entities;

public enum TradeDirection { Buy, Sell }
public enum TradeStatus { Open, Closed }

public class Trade
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid SessionId { get; set; }
    
    public TradeDirection Direction { get; set; }
    public TradeStatus Status { get; set; } = TradeStatus.Open;
    
    // Financial Precision
    public decimal EntryPrice { get; set; }
    public decimal StopLoss { get; set; }
    public decimal TakeProfit { get; set; }
    public decimal LotSize { get; set; }
    
    public decimal? ExitPrice { get; set; }
    public decimal PnL { get; set; } = 0;
    
    public DateTime OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
}