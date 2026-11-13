namespace PickupManagement.Domain.Entities;

public class PickupPlanOrder
{
    public Guid Id { get; set; }
    public Guid PickupPlanId { get; set; }
    public string DataAreaId { get; set; } = string.Empty;
    public string SalesId { get; set; } = string.Empty;
    public string? OrderStatusSnapshot { get; set; }
    public DateTime AddedAt { get; set; }
    public string AddedBy { get; set; } = string.Empty;

    /// <summary>
    /// Maintained in sync with PickupPlan.Status (true while PLANNED or ARRIVED)
    /// to back the SQL Server filtered unique index preventing a sales order from
    /// being assigned to two active pickup plans in the same company.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public PickupPlan PickupPlan { get; set; } = null!;
    public PickupTicketOrder? TicketOrder { get; set; }
}
