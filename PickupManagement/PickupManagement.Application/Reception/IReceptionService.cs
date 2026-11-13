namespace PickupManagement.Application.Reception;

public interface IReceptionService
{
    Task<ArrivalTicketResponse> ConfirmArrivalAsync(
        Guid pickupPlanId,
        CancellationToken cancellationToken = default);

    Task<ArrivalTicketResponse> RegisterWalkInArrivalAsync(
        WalkInArrivalRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TicketQueueItemDto>> GetQueueAsync(
        DateOnly date,
        CancellationToken cancellationToken = default);

    Task<TicketDetailDto> GetTicketDetailAsync(
        Guid ticketId,
        CancellationToken cancellationToken = default);
}
