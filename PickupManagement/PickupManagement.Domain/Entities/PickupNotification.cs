using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class PickupNotification
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public DisplayEventType DisplayEventType { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.PENDING;

    public PickupTicket Ticket { get; set; } = null!;
}
