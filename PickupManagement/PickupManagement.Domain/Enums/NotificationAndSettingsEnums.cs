namespace PickupManagement.Domain.Enums;

public enum DisplayEventType
{
    NOW_SERVING,
    ORDER_READY,
    COLLECTED,
    REMOVED
}

public enum NotificationStatus
{
    PENDING,
    PUBLISHED,
    FAILED
}

public enum QueuePolicy
{
    FIFO,
    PRIORITY_OVERRIDE
}

public enum PartialOrderPolicy
{
    BLOCK_TICKET,
    ALLOW_REMOVAL_BY_SUPERVISOR
}
