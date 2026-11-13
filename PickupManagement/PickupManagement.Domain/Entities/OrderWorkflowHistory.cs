namespace PickupManagement.Domain.Entities;

public class OrderWorkflowHistory
{
    public long Id { get; set; }
    public Guid TicketOrderId { get; set; }
    public string? OldStatus { get; set; }
    public string NewStatus { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    public Guid CorrelationId { get; set; }

    public PickupTicketOrder TicketOrder { get; set; } = null!;
}
