namespace PickupManagement.Application.Notifications;

public interface IPickupRealtimeNotifier
{
    Task NotifyQueueUpdatedAsync(Guid ticketId, string eventType, CancellationToken cancellationToken = default);
    Task NotifyPublicDisplayUpdatedAsync(CancellationToken cancellationToken = default);
}
