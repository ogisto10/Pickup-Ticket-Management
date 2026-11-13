using Microsoft.AspNetCore.SignalR;
using PickupManagement.Api.Hubs;
using PickupManagement.Application.Notifications;

namespace PickupManagement.Api.Notifications;

public class SignalRPickupNotifier : IPickupRealtimeNotifier
{
    private readonly IHubContext<PickupHub> _hubContext;

    public SignalRPickupNotifier(IHubContext<PickupHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyQueueUpdatedAsync(
        Guid ticketId,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients
            .Group(PickupHub.OperationsGroup)
            .SendAsync("QueueUpdated", new { ticketId, eventType, timestamp = DateTime.UtcNow }, cancellationToken);
    }

    public async Task NotifyPublicDisplayUpdatedAsync(CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients
            .Group(PickupHub.PublicDisplayGroup)
            .SendAsync("DisplayStateChanged", new { timestamp = DateTime.UtcNow }, cancellationToken);
    }
}
