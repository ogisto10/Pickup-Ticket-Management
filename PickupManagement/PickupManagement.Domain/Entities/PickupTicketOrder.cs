using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class PickupTicketOrder
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid PickupPlanOrderId { get; set; }
    public string DataAreaId { get; set; } = string.Empty;
    public string SalesId { get; set; } = string.Empty;
    public PickupTicketOrderStatus Status { get; set; } = PickupTicketOrderStatus.PENDING_CREDIT;
    public OrderCreditStatus CreditStatus { get; set; } = OrderCreditStatus.PENDING;
    public OrderWarehouseStatus WarehouseStatus { get; set; } = OrderWarehouseStatus.PENDING;
    public DateTime? LastAxSyncAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public PickupTicket Ticket { get; set; } = null!;
    public PickupPlanOrder PickupPlanOrder { get; set; } = null!;
    public ICollection<OrderWorkflowHistory> WorkflowHistory { get; set; } = new List<OrderWorkflowHistory>();
}
