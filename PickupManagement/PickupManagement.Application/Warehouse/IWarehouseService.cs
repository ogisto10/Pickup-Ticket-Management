namespace PickupManagement.Application.Warehouse;

public interface IWarehouseService
{
    Task<OrderPreparationResultDto> StartPreparationAsync(
        Guid ticketId,
        Guid orderId,
        PreparationUpdateRequest? request,
        CancellationToken cancellationToken = default);

    Task<OrderPreparationResultDto> MarkOrderReadyAsync(
        Guid ticketId,
        Guid orderId,
        PreparationUpdateRequest? request,
        CancellationToken cancellationToken = default);

    Task<CollectionResultDto> ConfirmCollectionAsync(
        Guid ticketId,
        CollectionConfirmRequest? request,
        CancellationToken cancellationToken = default);

    Task<OrderPreparationResultDto> RemoveBlockedOrderAsync(
        Guid ticketId,
        Guid orderId,
        RemoveBlockedOrderRequest request,
        CancellationToken cancellationToken = default);
}
