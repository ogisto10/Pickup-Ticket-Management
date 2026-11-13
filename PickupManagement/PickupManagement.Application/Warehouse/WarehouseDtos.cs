using PickupManagement.Domain.Enums;

namespace PickupManagement.Application.Warehouse;

public record PreparationUpdateRequest(
    string? Comment);

public record CollectionConfirmRequest(
    string? Comment);

public record RemoveBlockedOrderRequest(
    string Reason);

public record OrderPreparationResultDto(
    Guid TicketId,
    string TicketNumber,
    PickupTicketStatus TicketStatus,
    Guid OrderId,
    string SalesId,
    PickupTicketOrderStatus OrderStatus,
    OrderWarehouseStatus WarehouseStatus,
    bool TicketReadyForCollection,
    DateTime? ReadyAt);

public record CollectionResultDto(
    Guid TicketId,
    string TicketNumber,
    PickupTicketStatus TicketStatus,
    DateTime CollectedAt,
    string CollectedBy);
