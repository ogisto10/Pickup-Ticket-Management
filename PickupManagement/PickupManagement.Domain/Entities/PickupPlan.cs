using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class PickupPlan
{
    public Guid Id { get; set; }
    public string CustomerAccount { get; set; } = string.Empty;
    public string CustomerNameSnapshot { get; set; } = string.Empty;
    public DateOnly PickupDate { get; set; }
    public string WarehouseId { get; set; } = string.Empty;
    public PickupPlanStatus Status { get; set; } = PickupPlanStatus.PLANNED;
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<PickupPlanOrder> Orders { get; set; } = new List<PickupPlanOrder>();
    public PickupTicket? Ticket { get; set; }
}
