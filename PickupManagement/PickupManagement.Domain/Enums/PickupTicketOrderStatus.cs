namespace PickupManagement.Domain.Enums;

public enum PickupTicketOrderStatus
{
    PENDING_CREDIT,
    RELEASE_PENDING,
    RECONCILING,
    RELEASED,
    IN_PREPARATION,
    READY,
    BLOCKED,
    CANCELLED,
    COLLECTED
}
