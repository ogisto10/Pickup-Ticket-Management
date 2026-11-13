using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class PickupTicket
{
    public Guid Id { get; set; }
    public Guid PickupPlanId { get; set; }
    public DateOnly TicketDate { get; set; }
    public int DailySequence { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public DateTime ArrivalTime { get; set; }
    public int QueueNumber { get; set; }
    public PickupTicketStatus Status { get; set; } = PickupTicketStatus.ARRIVED;
    public string? CreditDecisionBy { get; set; }
    public DateTime? CreditDecisionAt { get; set; }
    public string? CreditComment { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? CollectedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public PickupPlan PickupPlan { get; set; } = null!;
    public ICollection<PickupTicketOrder> Orders { get; set; } = new List<PickupTicketOrder>();
    public ICollection<PickupWorkflowHistory> WorkflowHistory { get; set; } = new List<PickupWorkflowHistory>();
    public ICollection<PickupNotification> Notifications { get; set; } = new List<PickupNotification>();
}
